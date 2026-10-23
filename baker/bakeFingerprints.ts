import * as _ from "lodash-es"
import { OwidGdocType, Url } from "@ourworldindata/utils"
import * as db from "../db/db.js"
import { getAllPublishedMultiDimDataPages } from "../db/model/MultiDimDataPage.js"
import { hashMd5 } from "../serverUtils/hash.js"
import { PageFingerprints } from "./bakeState.js"

// Fingerprints of what each kind of page reads from the database when it is
// rendered. They cover the inputs that change between two full bakes: a
// page's own config or content, the metadata of the indicators it shows, the
// charts it lists ("related charts", the all-charts block) and what it links
// to or embeds. Inputs that aren't covered are refreshed by the next full
// bake. They change rarely: a data page's
// "related research" (ordered by pageviews) and primary topic, what the data
// page redesign experiment adds (related charts by coview, dataset owners),
// the authors of an article, the tag hierarchy, replaced images behind
// featured images and static visualizations, donors, and the archive. Two
// inputs no page in these steps reads today, and that would need covering
// once one does: data-callout values (data, not metadata; only profiles use
// them) and the legacy WordPress blocks some explorers embed (frozen).

const fingerprint = (parts: unknown[]): string => hashMd5(JSON.stringify(parts))

type Version = string

/** What a list of charts shows about each of them */
interface ChartListing {
    chartId: number
    slug: string
    title: string | null
    variantName: string | null
    tagId: number
    isUnlistedTag: number
    keyChartLevel: number | null
}

/** Inputs that the fingerprints of several bake steps share */
export interface FingerprintInputs {
    variableVersions: Map<number, Version>
    /** Published charts, one row per tag; untagged charts aren't listed */
    chartListings: ChartListing[]
}

export const getFingerprintInputs = async (
    knex: db.KnexReadonlyTransaction
): Promise<FingerprintInputs> => ({
    variableVersions: await getVariableVersions(knex),
    chartListings: await db.knexRaw<ChartListing>(
        knex,
        `-- sql
            SELECT
                c.id AS chartId,
                cc.slug,
                cc.config ->> "$.title" AS title,
                cc.config ->> "$.variantName" AS variantName,
                ct.tagId,
                t.name = 'Unlisted' AS isUnlistedTag,
                ct.keyChartLevel
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            JOIN chart_tags ct ON ct.chartId = c.id
            JOIN tags t ON t.id = ct.tagId
            WHERE cc.config ->> "$.isPublished" = "true"
            ORDER BY c.id, ct.tagId`
    ),
})

/**
 * The version of everything a page reads about an indicator. ETL's
 * metadataChecksum covers the indicator's metadata and origins but not its
 * data values, which pages fetch at runtime, so a data-only update re-renders
 * nothing. Indicators that ETL didn't write fall back to updatedAt.
 */
const getVariableVersions = async (
    knex: db.KnexReadonlyTransaction
): Promise<Map<number, Version>> => {
    const variables = await db.knexRaw<{
        id: number
        metadataChecksum: string | null
        updatedAt: Date | null
        nonRedistributable: number | null
        etlConfigMd5: string | null
    }>(
        knex,
        `-- sql
            SELECT
                v.id,
                v.metadataChecksum,
                v.updatedAt,
                d.nonRedistributable,
                etl.configMd5 AS etlConfigMd5
            FROM (
                SELECT variableId FROM chart_dimensions
                UNION SELECT variableId FROM multi_dim_x_chart_configs
                UNION SELECT variableId FROM explorer_variables
            ) used
            JOIN variables v ON v.id = used.variableId
            LEFT JOIN datasets d ON d.id = v.datasetId
            LEFT JOIN chart_configs etl ON etl.id = v.patchConfigIdETL`
    )
    // A data page shows the FAQs that are linked to its indicator
    const faqs = await db.knexRaw<{
        variableId: number
        gdocId: string
        updatedAt: Date
    }>(
        knex,
        `-- sql
            SELECT f.variableId, f.gdocId, g.updatedAt
            FROM posts_gdocs_variables_faqs f
            JOIN posts_gdocs g ON g.id = f.gdocId
            ORDER BY f.variableId, f.gdocId`
    )
    const faqsByVariableId = _.groupBy(faqs, (faq) => faq.variableId)

    return new Map(
        variables.map((variable) => [
            variable.id,
            fingerprint([
                variable.metadataChecksum ?? variable.updatedAt,
                variable.nonRedistributable,
                variable.etlConfigMd5,
                (faqsByVariableId[variable.id] ?? []).map((faq) => [
                    faq.gdocId,
                    faq.updatedAt,
                ]),
            ]),
        ])
    )
}

const versionsOf = (
    variableIds: Iterable<number>,
    variableVersions: Map<number, Version>
): [number, Version | undefined][] =>
    _.sortBy(_.uniq([...variableIds]), (id) => id).map((id) => [
        id,
        variableVersions.get(id),
    ])

/**
 * Keyed by chart id. Besides the chart's own config and indicators, a chart
 * page lists other charts and the gdocs that embed it, so renaming a chart or
 * a gdoc re-renders the chart pages that list it:
 * - a data page lists the charts that use its indicator
 *   (getRelatedChartsForVariable);
 * - a grapher page lists the charts tagged like the post in its originUrl
 *   (getPostRelatedCharts), and the gdocs that link to it
 *   (getGdocsPostReferencesByChartId).
 */
export const getChartPageFingerprints = async (
    knex: db.KnexReadonlyTransaction,
    { variableVersions, chartListings }: FingerprintInputs
): Promise<PageFingerprints> => {
    // Same selection as bakeAllChangedGrapherPagesAndDeleteRemovedGraphers
    const charts = await db.knexRaw<{
        id: number
        slug: string
        configMd5: string
        originUrl: string | null
    }>(
        knex,
        `-- sql
            SELECT
                c.id,
                cc.slug,
                cc.configMd5,
                cc.config ->> "$.originUrl" AS originUrl
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE JSON_EXTRACT(cc.config, "$.isPublished") = true`
    )
    const postTags = await db.knexRaw<{ slug: string; tagId: number }>(
        knex,
        `-- sql
            SELECT p.slug, pt.tag_id AS tagId
            FROM posts p
            JOIN post_tags pt ON pt.post_id = p.id
            ORDER BY p.slug, pt.tag_id`
    )
    const slugRedirects = await db.knexRaw<{ chartId: number; slug: string }>(
        knex,
        `-- sql
            SELECT chart_id AS chartId, slug
            FROM chart_slug_redirects
            ORDER BY chart_id, slug`
    )
    const referencingGdocs = await db.knexRaw<{
        target: string
        id: string
        slug: string
        title: string | null
        type: string
    }>(
        knex,
        `-- sql
            SELECT DISTINCT
                pgl.target,
                pg.id,
                pg.slug,
                pg.content ->> '$.title' AS title,
                pg.type
            FROM posts_gdocs pg
            JOIN posts_gdocs_links pgl ON pg.id = pgl.sourceId
            WHERE pg.type != 'fragment' AND pg.published = 1
            ORDER BY pgl.target, pg.id`
    )
    const tagIdsByPostSlug = _.groupBy(postTags, (row) => row.slug)
    const redirectSlugsByChartId = _.groupBy(slugRedirects, (r) => r.chartId)
    const referencingGdocsByTarget = _.groupBy(
        referencingGdocs,
        (r) => r.target
    )
    const listingsByTagId = _.groupBy(chartListings, (l) => l.tagId)
    const dimensions = await db.knexRaw<{
        chartId: number
        variableId: number
        property: string
    }>(
        knex,
        `-- sql
            SELECT chartId, variableId, property
            FROM chart_dimensions
            ORDER BY chartId, variableId`
    )
    const dimensionsByChartId = _.groupBy(dimensions, (d) => d.chartId)
    // In chart id order, since the dimensions are
    const chartIdsByVariableId = _.mapValues(
        _.groupBy(dimensions, (d) => d.variableId),
        (dims) => _.uniq(dims.map((d) => d.chartId))
    )
    const listingsByChartId = _.groupBy(chartListings, (l) => l.chartId)

    // Only the y indicators of a chart are what its data page is about
    const relatedChartsVersion = _.memoize((variableId: number): Version =>
        fingerprint(
            (chartIdsByVariableId[variableId] ?? []).flatMap(
                (chartId) => listingsByChartId[chartId] ?? []
            )
        )
    )

    return Object.fromEntries(
        charts.map((chart) => {
            const dims = dimensionsByChartId[chart.id] ?? []
            const originPostSlug = Url.fromURL(chart.originUrl ?? "").slug
            const linkTargets = [
                chart.slug,
                ...(redirectSlugsByChartId[chart.id] ?? []).map((r) => r.slug),
            ]
            return [
                chart.id.toString(),
                fingerprint([
                    chart.slug,
                    chart.configMd5,
                    versionsOf(
                        dims.map((d) => d.variableId),
                        variableVersions
                    ),
                    _.uniq(
                        dims
                            .filter((d) => d.property === "y")
                            .map((d) => d.variableId)
                    ).map(relatedChartsVersion),
                    (originPostSlug
                        ? (tagIdsByPostSlug[originPostSlug] ?? [])
                        : []
                    ).map((row) => listingsByTagId[row.tagId] ?? []),
                    linkTargets.map(
                        (target) => referencingGdocsByTarget[target] ?? []
                    ),
                ]),
            ]
        })
    )
}

/** Keyed by slug */
export const getMultiDimPageFingerprints = async (
    knex: db.KnexReadonlyTransaction,
    { variableVersions }: FingerprintInputs
): Promise<PageFingerprints> => {
    const multiDims = await getAllPublishedMultiDimDataPages(knex)
    const views = await db.knexRaw<{
        multiDimId: number
        viewId: string
        variableId: number
        configMd5: string
    }>(
        knex,
        `-- sql
            SELECT mx.multiDimId, mx.viewId, mx.variableId, cc.configMd5
            FROM multi_dim_x_chart_configs mx
            JOIN chart_configs cc ON cc.id = mx.chartConfigId
            ORDER BY mx.multiDimId, mx.viewId`
    )
    const viewsByMultiDimId = _.groupBy(views, (view) => view.multiDimId)

    return Object.fromEntries(
        multiDims.map((multiDim) => {
            const views = viewsByMultiDimId[multiDim.id] ?? []
            return [
                multiDim.slug,
                fingerprint([
                    multiDim.updatedAt,
                    multiDim.config,
                    views.map((view) => [view.viewId, view.configMd5]),
                    versionsOf(
                        views.map((view) => view.variableId),
                        variableVersions
                    ),
                ]),
            ]
        })
    )
}

/**
 * Keyed by slug. Unpublished explorers are included, so that publishing one
 * changes its fingerprint even if nothing else about it changed.
 */
export const getExplorerPageFingerprints = async (
    knex: db.KnexReadonlyTransaction,
    { variableVersions }: FingerprintInputs
): Promise<PageFingerprints> => {
    const explorers = await db.knexRaw<{
        slug: string
        isPublished: number
        updatedAt: Date
        configMd5: string
    }>(
        knex,
        `-- sql
            SELECT slug, isPublished, updatedAt, MD5(config) AS configMd5
            FROM explorers`
    )
    const charts = await db.knexRaw<{
        explorerSlug: string
        chartId: number
        configMd5: string
    }>(
        knex,
        `-- sql
            SELECT ec.explorerSlug, ec.chartId, cc.configMd5
            FROM explorer_charts ec
            JOIN charts c ON c.id = ec.chartId
            JOIN chart_configs cc ON cc.id = c.configId
            ORDER BY ec.explorerSlug, ec.chartId`
    )
    const variables = await db.knexRaw<{
        explorerSlug: string
        variableId: number
    }>(knex, `SELECT explorerSlug, variableId FROM explorer_variables`)
    const chartsBySlug = _.groupBy(charts, (chart) => chart.explorerSlug)
    const variablesBySlug = _.groupBy(variables, (v) => v.explorerSlug)

    return Object.fromEntries(
        explorers.map((explorer) => [
            explorer.slug,
            fingerprint([
                explorer.isPublished,
                explorer.updatedAt,
                explorer.configMd5,
                (chartsBySlug[explorer.slug] ?? []).map((chart) => [
                    chart.chartId,
                    chart.configMd5,
                ]),
                versionsOf(
                    (variablesBySlug[explorer.slug] ?? []).map(
                        (v) => v.variableId
                    ),
                    variableVersions
                ),
            ]),
        ])
    )
}

/**
 * Keyed by slug. Covers the gdoc itself, its tags (breadcrumbs), its images,
 * the version of everything it links to or embeds: other gdocs (their title,
 * excerpt and thumbnail appear in link previews), charts, multi-dims,
 * explorers, narrative charts and static visualizations; for gdocs with an
 * all-charts block, the charts tagged with the gdoc's tags; and for
 * announcements, the other announcements (their carousel).
 */
export const getGdocPostFingerprints = async (
    knex: db.KnexReadonlyTransaction,
    { chartListings }: FingerprintInputs
): Promise<PageFingerprints> => {
    // Same selection as getPublishedGdocsWithTags. contentMd5 catches a
    // second edit within the same second, which updatedAt can't tell apart.
    const gdocs = await db.knexRaw<{
        id: string
        slug: string
        type: string
        updatedAt: Date
        contentMd5: string
        publishedAt: Date
    }>(
        knex,
        `-- sql
            SELECT id, slug, type, updatedAt, contentMd5, publishedAt
            FROM posts_gdocs
            WHERE published = 1
                AND type IN (?)
                AND publishedAt <= NOW()
            ORDER BY publishedAt DESC, id`,
        [db.GDOC_POST_BAKE_TYPES]
    )
    // Announcement pages show the latest announcements of their kind; any
    // change to an announcement re-renders all of them, which is few pages
    const announcementsVersion = fingerprint(
        gdocs
            .filter((gdoc) => gdoc.type === OwidGdocType.Announcement)
            .map((gdoc) => [gdoc.id, gdoc.updatedAt, gdoc.contentMd5])
    )
    const tags = await db.knexRaw<{ gdocId: string; tagId: number }>(
        knex,
        `SELECT gdocId, tagId FROM posts_gdocs_x_tags ORDER BY gdocId, tagId`
    )
    const images = await db.knexRaw<{
        gdocId: string
        imageId: number
        updatedAt: Date | null
    }>(
        knex,
        `-- sql
            SELECT gi.gdocId, gi.imageId, i.updatedAt
            FROM posts_gdocs_x_images gi
            JOIN images i ON i.id = gi.imageId
            ORDER BY gi.gdocId, gi.imageId`
    )
    const links = await db.knexRaw<{
        sourceId: string
        linkType: string
        target: string
    }>(
        knex,
        `-- sql
            SELECT DISTINCT sourceId, linkType, target
            FROM posts_gdocs_links
            WHERE linkType IN (
                'gdoc', 'grapher', 'explorer', 'narrative-chart', 'static-viz'
            )
            ORDER BY sourceId, linkType, target`
    )
    const linkTargetVersions = await getGdocLinkTargetVersions(knex)
    const gdocIdsWithAllChartsBlock = new Set(
        (
            await db.knexRaw<{ gdocId: string }>(
                knex,
                `-- sql
                    SELECT DISTINCT gdocId
                    FROM posts_gdocs_components
                    WHERE config ->> "$.type" = "all-charts"`
            )
        ).map((row) => row.gdocId)
    )

    const tagsByGdocId = _.groupBy(tags, (tag) => tag.gdocId)
    const imagesByGdocId = _.groupBy(images, (image) => image.gdocId)
    const linksByGdocId = _.groupBy(links, (link) => link.sourceId)
    const listingsByTagId = _.groupBy(chartListings, (l) => l.tagId)

    return Object.fromEntries(
        gdocs.map((gdoc) => {
            const tagIds = (tagsByGdocId[gdoc.id] ?? []).map((t) => t.tagId)
            return [
                gdoc.slug,
                fingerprint([
                    gdoc.id,
                    gdoc.updatedAt,
                    gdoc.contentMd5,
                    gdoc.publishedAt,
                    gdoc.type === OwidGdocType.Announcement
                        ? announcementsVersion
                        : null,
                    tagIds,
                    (imagesByGdocId[gdoc.id] ?? []).map((image) => [
                        image.imageId,
                        image.updatedAt,
                    ]),
                    (linksByGdocId[gdoc.id] ?? []).map((link) => [
                        link.linkType,
                        link.target,
                        linkTargetVersions[link.linkType]?.get(link.target),
                    ]),
                    gdocIdsWithAllChartsBlock.has(gdoc.id)
                        ? tagIds.map((tagId) => listingsByTagId[tagId] ?? [])
                        : null,
                ]),
            ]
        })
    )
}

/** By link type, the version of each link target, keyed as links name it */
const getGdocLinkTargetVersions = async (
    knex: db.KnexReadonlyTransaction
): Promise<Record<string, Map<string, Version>>> => {
    // Each query selects a `target` (as links name it) and its `version`; when
    // a target appears in several rows, the last one wins
    const queryVersions = async (sql: string): Promise<Map<string, Version>> =>
        new Map(
            (
                await db.knexRaw<{ target: string; version: unknown }>(
                    knex,
                    sql
                )
            ).map((row) => [row.target, JSON.stringify(row.version)])
        )

    return {
        // A linked gdoc whose scheduled publication time passes changes too
        gdoc: await queryVersions(`-- sql
            SELECT
                id AS target,
                JSON_ARRAY(published, publishedAt <= NOW(), slug, updatedAt, contentMd5) AS version
            FROM posts_gdocs`),
        // A grapher link can point at a standalone chart or a multi-dim, by
        // its current slug or by one that redirects to it. Current slugs come
        // last, so they win over a redirect from a reused slug.
        grapher: await queryVersions(`-- sql
            SELECT target, version FROM (
                SELECT 0 AS priority, csr.slug AS target, cc.configMd5 AS version
                FROM chart_slug_redirects csr
                JOIN charts c ON c.id = csr.chart_id
                JOIN chart_configs cc ON cc.id = c.configId
                UNION ALL
                SELECT
                    0 AS priority,
                    REPLACE(mdr.source, '/grapher/', '') AS target,
                    JSON_ARRAY(mddp.published, mddp.updatedAt, MD5(mddp.config)) AS version
                FROM multi_dim_redirects mdr
                JOIN multi_dim_data_pages mddp ON mddp.id = mdr.multiDimId
                WHERE mdr.source LIKE '/grapher/%'
                UNION ALL
                SELECT 1 AS priority, cc.slug AS target, cc.configMd5 AS version
                FROM charts c
                JOIN chart_configs cc ON cc.id = c.configId
                UNION ALL
                SELECT
                    2 AS priority,
                    slug AS target,
                    JSON_ARRAY(published, updatedAt, MD5(config)) AS version
                FROM multi_dim_data_pages
                WHERE slug IS NOT NULL
            ) targets
            ORDER BY priority`),
        explorer: await queryVersions(`-- sql
            SELECT
                slug AS target,
                JSON_ARRAY(isPublished, updatedAt, MD5(config)) AS version
            FROM explorers`),
        "narrative-chart": await queryVersions(`-- sql
            SELECT nc.name AS target, JSON_ARRAY(nc.updatedAt, cc.configMd5) AS version
            FROM narrative_charts nc
            JOIN chart_configs cc ON cc.id = nc.chartConfigId`),
        "static-viz": await queryVersions(`-- sql
            SELECT name AS target, updatedAt AS version
            FROM static_viz`),
    }
}
