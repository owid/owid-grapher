import crypto from "crypto"
import * as _ from "lodash-es"
import {
    QueryParams,
    Url,
    queryParamsToStr,
    searchParamsToMultiDimView,
    strToQueryParams,
} from "@ourworldindata/utils"
import {
    GDOCS_CHART_PREVIEW_EXPLORER_URL,
    GDOCS_CHART_PREVIEW_GRAPHER_URL,
} from "../../../../settings/serverSettings.js"
import * as db from "../../../db.js"
import { getMultiDimDataPageBySlug } from "../../MultiDimDataPage.js"
import { getMultiDimRedirectTargets } from "../../MultiDimRedirects.js"
import { type ChartPreviewComponentSpec } from "./chartPreviewBlocks.js"

/**
 * Maps chart components to the public PNG URL Google should fetch for their
 * preview image.
 *
 * The URL carries a version hash of everything that changes what the chart
 * looks like: its config and the data and metadata of the indicators it shows
 * (for explorers: the explorer config, its views and all their indicators).
 * Google keeps the URL an image was inserted from (as `sourceUri`), so an
 * image is up to date exactly when its `sourceUri` equals the URL we'd insert
 * now. The hash also busts the thumbnail cache on Cloudflare.
 */

export type ChartPreviewSource =
    | { status: "resolved"; imageUrl: string }
    | { status: "unresolved"; message: string }

// Bump to re-render all preview images, e.g. after changing their size
const PREVIEW_FORMAT_VERSION = "1"

export function chartPreviewSpecKey(spec: ChartPreviewComponentSpec): string {
    return `${spec.type}:${spec.target}`
}

interface ChartConfigVersionInfo {
    configId: string
    configMd5: string
    variableIds: number[]
}

type VariableChecksums = Map<
    number,
    { dataChecksum: string | null; metadataChecksum: string | null }
>

function parseVariableIds(value: unknown): number[] {
    const parsed = typeof value === "string" ? JSON.parse(value) : value
    return Array.isArray(parsed)
        ? parsed.filter((id): id is number => typeof id === "number")
        : []
}

async function getVariableChecksums(
    knex: db.KnexReadonlyTransaction,
    variableIds: number[]
): Promise<VariableChecksums> {
    if (variableIds.length === 0) return new Map()
    const rows = await knex("variables")
        .select("id", "dataChecksum", "metadataChecksum")
        .whereIn("id", [...new Set(variableIds)])
    return new Map(rows.map((row) => [row.id, row]))
}

/** What a component renders, and what the image depends on */
type ResolvedTarget =
    | {
          status: "resolved"
          /** The PNG URL without query params */
          baseUrl: string
          queryStr: string
          /** Hashes of the configs involved */
          configHashes: string[]
          /** Indicators whose checksums go into the version */
          variableIds: number[]
      }
    | { status: "unresolved"; message: string }

type ResolvedGrapherTarget = Extract<ResolvedTarget, { status: "resolved" }>

function computeVersion(
    target: ResolvedGrapherTarget,
    checksums: VariableChecksums
): string {
    const variables = target.variableIds
        .toSorted((a, b) => a - b)
        .map((id) => {
            const checksum = checksums.get(id)
            return `${id}:${checksum?.dataChecksum}:${checksum?.metadataChecksum}`
        })
    return crypto
        .createHash("md5")
        .update(
            [PREVIEW_FORMAT_VERSION, ...target.configHashes, ...variables].join(
                "|"
            )
        )
        .digest("hex")
        .slice(0, 12)
}

function appendVersion(
    baseUrl: string,
    queryStr: string,
    version: string
): string {
    const separator = queryStr ? "&" : "?"
    return `${baseUrl}${queryStr}${separator}v=${version}`
}

/**
 * Grapher configs are rendered by id rather than slug, so that drafts render
 * too and a slug change doesn't break the preview.
 */
function makeGrapherTarget(
    info: ChartConfigVersionInfo,
    queryStr: string
): ResolvedTarget {
    return {
        status: "resolved",
        baseUrl: `${GDOCS_CHART_PREVIEW_GRAPHER_URL}/by-uuid/${info.configId}.png`,
        queryStr,
        configHashes: [info.configMd5],
        variableIds: info.variableIds,
    }
}

/**
 * Standalone charts by current or redirected slug. Prefers a chart's current
 * slug over a redirect, and published charts over drafts that share a slug.
 */
async function getChartConfigsBySlug(
    knex: db.KnexReadonlyTransaction,
    slugs: string[]
): Promise<Map<string, ChartConfigVersionInfo>> {
    if (slugs.length === 0) return new Map()
    const rows = await db.knexRaw<{
        slug: string
        configId: string
        configMd5: string
        variableIds: unknown
        priority: number
    }>(
        knex,
        `-- sql
        SELECT
            cc.slug,
            cc.id AS configId,
            cc.configMd5,
            JSON_EXTRACT(cc.config, '$.dimensions[*].variableId') AS variableIds,
            IF(cc.config ->> '$.isPublished' = 'true', 2, 1) AS priority
        FROM charts c
        JOIN chart_configs cc ON cc.id = c.configId
        WHERE cc.slug IN (?)
        UNION ALL
        SELECT
            r.slug,
            cc.id AS configId,
            cc.configMd5,
            JSON_EXTRACT(cc.config, '$.dimensions[*].variableId') AS variableIds,
            0 AS priority
        FROM chart_slug_redirects r
        JOIN charts c ON c.id = r.chart_id
        JOIN chart_configs cc ON cc.id = c.configId
        WHERE r.slug IN (?)
        ORDER BY priority ASC`,
        [slugs, slugs]
    )
    // Rows are ordered by ascending priority, so the best match is set last
    return new Map(
        rows.map((row) => [
            row.slug,
            {
                configId: row.configId,
                configMd5: row.configMd5,
                variableIds: parseVariableIds(row.variableIds),
            },
        ])
    )
}

async function getChartConfigsById(
    knex: db.KnexReadonlyTransaction,
    ids: string[]
): Promise<Map<string, ChartConfigVersionInfo>> {
    if (ids.length === 0) return new Map()
    const rows = await db.knexRaw<{
        configId: string
        configMd5: string
        variableIds: unknown
    }>(
        knex,
        `-- sql
        SELECT
            id AS configId,
            configMd5,
            JSON_EXTRACT(config, '$.dimensions[*].variableId') AS variableIds
        FROM chart_configs
        WHERE id IN (?)`,
        [[...new Set(ids)]]
    )
    return new Map(
        rows.map((row) => [
            row.configId,
            {
                configId: row.configId,
                configMd5: row.configMd5,
                variableIds: parseVariableIds(row.variableIds),
            },
        ])
    )
}

interface GrapherLink {
    key: string
    slug: string
    queryParams: QueryParams
}

/**
 * Multi-dims render the grapher config of the view the query params select.
 * The dimension params only pick the view, so they're dropped from the image
 * URL; the remaining ones (time, country, tab, ...) apply to the view.
 */
async function resolveMultiDimLinks(
    knex: db.KnexReadonlyTransaction,
    links: GrapherLink[]
): Promise<Map<string, ResolvedTarget>> {
    const targets = new Map<string, ResolvedTarget>()
    const multiDims = new Map(
        await Promise.all(
            _.uniq(links.map((link) => link.slug)).map(
                async (slug) =>
                    [
                        slug,
                        await getMultiDimDataPageBySlug(knex, slug, {
                            onlyPublished: false,
                        }),
                    ] as const
            )
        )
    )

    const views: { key: string; viewConfigId: string; queryStr: string }[] = []
    for (const { key, slug, queryParams } of links) {
        const multiDim = multiDims.get(slug)
        if (!multiDim) {
            targets.set(key, {
                status: "unresolved",
                message: "No chart or multi-dim with this slug",
            })
            continue
        }
        const { config } = multiDim
        try {
            const view = searchParamsToMultiDimView(
                config,
                new URLSearchParams(queryParamsToStr(queryParams))
            )
            const dimensionSlugs = config.dimensions.map((d) => d.slug)
            views.push({
                key,
                viewConfigId: view.fullConfigId,
                queryStr: queryParamsToStr(_.omit(queryParams, dimensionSlugs)),
            })
        } catch {
            targets.set(key, {
                status: "unresolved",
                message: "No view of this multi-dim matches the link",
            })
        }
    }

    const viewConfigs = await getChartConfigsById(
        knex,
        views.map((view) => view.viewConfigId)
    )
    for (const { key, viewConfigId, queryStr } of views) {
        const info = viewConfigs.get(viewConfigId)
        targets.set(
            key,
            info
                ? makeGrapherTarget(info, queryStr)
                : { status: "unresolved", message: "Multi-dim view not found" }
        )
    }
    return targets
}

/**
 * Resolves /grapher/ links the way the site does: an old chart slug that now
 * redirects to a multi-dim goes there, then standalone charts, then multi-dims
 */
async function resolveGrapherLinks(
    knex: db.KnexReadonlyTransaction,
    links: GrapherLink[]
): Promise<Map<string, ResolvedTarget>> {
    const targets = new Map<string, ResolvedTarget>()
    const slugs = _.uniq(links.map((link) => link.slug))
    const [multiDimRedirects, chartsBySlug] = await Promise.all([
        getMultiDimRedirectTargets(knex, slugs, "/grapher/"),
        getChartConfigsBySlug(knex, slugs),
    ])

    const multiDimLinks: GrapherLink[] = []
    for (const link of links) {
        const redirect = multiDimRedirects.get(link.slug)
        const chart = chartsBySlug.get(link.slug)
        if (redirect) {
            multiDimLinks.push({
                key: link.key,
                slug: redirect.targetSlug,
                queryParams: {
                    ...strToQueryParams(redirect.queryStr),
                    ...link.queryParams,
                },
            })
        } else if (chart) {
            targets.set(
                link.key,
                makeGrapherTarget(chart, queryParamsToStr(link.queryParams))
            )
        } else {
            multiDimLinks.push(link)
        }
    }

    for (const [key, target] of await resolveMultiDimLinks(
        knex,
        multiDimLinks
    )) {
        targets.set(key, target)
    }
    return targets
}

/**
 * Explorers are rendered from their published page, which picks the view from
 * the query params. Only published explorers can be rendered. Explorers that
 * now redirect to a multi-dim resolve like on the site.
 *
 * The version covers the explorer config, the grapher configs of all its
 * views and the checksums of the indicators it uses, aggregated in SQL since
 * an explorer can have thousands of views. Data loaded from CSV files isn't
 * covered.
 */
async function resolveExplorerLinks(
    knex: db.KnexReadonlyTransaction,
    links: GrapherLink[]
): Promise<Map<string, ResolvedTarget>> {
    const targets = new Map<string, ResolvedTarget>()
    if (links.length === 0) return targets
    const slugs = _.uniq(links.map((link) => link.slug))
    const multiDimRedirects = await getMultiDimRedirectTargets(
        knex,
        slugs,
        "/explorers/"
    )
    const rows = await db.knexRaw<{
        slug: string
        isPublished: number
        configMd5: string
        viewsHash: string | null
        variablesHash: string | null
    }>(
        knex,
        `-- sql
        SELECT
            e.slug,
            e.isPublished,
            MD5(e.config) AS configMd5,
            (
                SELECT BIT_XOR(CRC32(cc.configMd5))
                FROM explorer_views ev
                JOIN chart_configs cc ON cc.id = ev.chartConfigId
                WHERE ev.explorerSlug = e.slug
            ) AS viewsHash,
            (
                SELECT BIT_XOR(CRC32(CONCAT_WS(
                    ':', v.id, v.dataChecksum, v.metadataChecksum
                )))
                FROM variables v
                WHERE v.id IN (
                    SELECT variableId
                    FROM explorer_variables
                    WHERE explorerSlug = e.slug
                    UNION
                    SELECT cd.variableId
                    FROM explorer_charts ec
                    JOIN chart_dimensions cd ON cd.chartId = ec.chartId
                    WHERE ec.explorerSlug = e.slug
                )
            ) AS variablesHash
        FROM explorers e
        WHERE e.slug IN (?)`,
        [slugs]
    )
    const explorersBySlug = new Map(rows.map((row) => [row.slug, row]))

    const multiDimLinks: GrapherLink[] = []
    for (const link of links) {
        const redirect = multiDimRedirects.get(link.slug)
        const explorer = explorersBySlug.get(link.slug)
        if (redirect) {
            multiDimLinks.push({
                key: link.key,
                slug: redirect.targetSlug,
                queryParams: {
                    ...strToQueryParams(redirect.queryStr),
                    ...link.queryParams,
                },
            })
        } else if (!explorer) {
            targets.set(link.key, {
                status: "unresolved",
                message: "No explorer with this slug",
            })
        } else if (!explorer.isPublished) {
            targets.set(link.key, {
                status: "unresolved",
                message: "Only published explorers can be rendered",
            })
        } else {
            targets.set(link.key, {
                status: "resolved",
                baseUrl: `${GDOCS_CHART_PREVIEW_EXPLORER_URL}/${link.slug}.png`,
                queryStr: queryParamsToStr(link.queryParams),
                configHashes: [
                    explorer.configMd5,
                    String(explorer.viewsHash),
                    String(explorer.variablesHash),
                ],
                variableIds: [],
            })
        }
    }

    for (const [key, target] of await resolveMultiDimLinks(
        knex,
        multiDimLinks
    )) {
        targets.set(key, target)
    }
    return targets
}

/** Narrative charts render their merged config, which is stored per chart */
async function resolveNarrativeCharts(
    knex: db.KnexReadonlyTransaction,
    names: { key: string; name: string }[]
): Promise<Map<string, ResolvedTarget>> {
    const targets = new Map<string, ResolvedTarget>()
    if (names.length === 0) return targets
    const rows: { name: string; chartConfigId: string }[] = await knex(
        "narrative_charts"
    )
        .select("name", "chartConfigId")
        .whereIn("name", _.uniq(names.map(({ name }) => name)))
    const configIdsByName = new Map(
        rows.map((row) => [row.name, row.chartConfigId])
    )
    const configs = await getChartConfigsById(knex, [
        ...configIdsByName.values(),
    ])
    for (const { key, name } of names) {
        const configId = configIdsByName.get(name)
        const info = configId ? configs.get(configId) : undefined
        targets.set(
            key,
            info
                ? makeGrapherTarget(info, "")
                : {
                      status: "unresolved",
                      message: "No narrative chart with this name",
                  }
        )
    }
    return targets
}

export async function resolveChartPreviewSources(
    knex: db.KnexReadonlyTransaction,
    specs: ChartPreviewComponentSpec[]
): Promise<Map<string, ChartPreviewSource>> {
    const sources = new Map<string, ChartPreviewSource>()
    const grapherLinks: GrapherLink[] = []
    const explorerLinks: GrapherLink[] = []
    const narrativeChartNames: { key: string; name: string }[] = []
    const seen = new Set<string>()

    for (const spec of specs) {
        const key = chartPreviewSpecKey(spec)
        if (seen.has(key)) continue
        seen.add(key)
        if (spec.type === "narrative-chart") {
            narrativeChartNames.push({ key, name: spec.target })
            continue
        }
        const url = Url.fromURL(spec.target)
        const link = { key, slug: url.slug ?? "", queryParams: url.queryParams }
        if (url.isGrapher && url.slug) {
            grapherLinks.push(link)
        } else if (url.isExplorer && url.slug) {
            explorerLinks.push(link)
        } else {
            sources.set(key, {
                status: "unresolved",
                message: "Not a link to a chart or explorer",
            })
        }
    }

    const targets = new Map([
        ...(await resolveGrapherLinks(knex, grapherLinks)),
        ...(await resolveExplorerLinks(knex, explorerLinks)),
        ...(await resolveNarrativeCharts(knex, narrativeChartNames)),
    ])

    const checksums = await getVariableChecksums(
        knex,
        [...targets.values()].flatMap((target) =>
            target.status === "resolved" ? target.variableIds : []
        )
    )
    for (const [key, target] of targets) {
        sources.set(
            key,
            target.status === "resolved"
                ? {
                      status: "resolved",
                      imageUrl: appendVersion(
                          target.baseUrl,
                          target.queryStr,
                          computeVersion(target, checksums)
                      ),
                  }
                : target
        )
    }

    return sources
}
