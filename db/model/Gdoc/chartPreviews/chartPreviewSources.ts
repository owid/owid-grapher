import crypto from "crypto"
import * as _ from "lodash-es"
import {
    QueryParams,
    Url,
    queryParamsToStr,
    searchParamsToMultiDimView,
    strToQueryParams,
} from "@ourworldindata/utils"
import { GDOCS_CHART_PREVIEW_GRAPHER_URL } from "../../../../settings/serverSettings.js"
import * as db from "../../../db.js"
import { getMultiDimDataPageBySlug } from "../../MultiDimDataPage.js"
import { getMultiDimRedirectTargets } from "../../MultiDimRedirects.js"
import { type ChartPreviewComponentSpec } from "./chartPreviewBlocks.js"

/**
 * Maps chart components to the public PNG URL Google should fetch for their
 * preview image.
 *
 * The URL carries a version hash of everything that changes what the chart
 * looks like: its config and the data and metadata of the indicators it shows.
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

function computeVersion(
    info: ChartConfigVersionInfo,
    checksums: VariableChecksums
): string {
    const variables = info.variableIds
        .toSorted((a, b) => a - b)
        .map((id) => {
            const checksum = checksums.get(id)
            return `${id}:${checksum?.dataChecksum}:${checksum?.metadataChecksum}`
        })
    return crypto
        .createHash("md5")
        .update(
            [PREVIEW_FORMAT_VERSION, info.configMd5, ...variables].join("|")
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
 * Charts are rendered by config id rather than slug, so that drafts render too
 * and a slug change doesn't break the preview.
 */
function makeGrapherPreviewUrl(
    info: ChartConfigVersionInfo,
    queryStr: string,
    checksums: VariableChecksums
): string {
    return appendVersion(
        `${GDOCS_CHART_PREVIEW_GRAPHER_URL}/by-uuid/${info.configId}.png`,
        queryStr,
        computeVersion(info, checksums)
    )
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

/** What a component renders: a grapher config, shown with some query params */
type ResolvedTarget =
    | { status: "resolved"; info: ChartConfigVersionInfo; queryStr: string }
    | { status: "unresolved"; message: string }

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
                ? { status: "resolved", info, queryStr }
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
            targets.set(link.key, {
                status: "resolved",
                info: chart,
                queryStr: queryParamsToStr(link.queryParams),
            })
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

export async function resolveChartPreviewSources(
    knex: db.KnexReadonlyTransaction,
    specs: ChartPreviewComponentSpec[]
): Promise<Map<string, ChartPreviewSource>> {
    const sources = new Map<string, ChartPreviewSource>()
    const grapherLinks: GrapherLink[] = []

    for (const spec of specs) {
        const key = chartPreviewSpecKey(spec)
        if (sources.has(key)) continue
        const url = Url.fromURL(spec.target)
        if (url.isGrapher && url.slug) {
            grapherLinks.push({
                key,
                slug: url.slug,
                queryParams: url.queryParams,
            })
        } else {
            sources.set(key, {
                status: "unresolved",
                message: "Not a link to a grapher chart",
            })
        }
    }

    const targets = await resolveGrapherLinks(knex, grapherLinks)

    const checksums = await getVariableChecksums(
        knex,
        [...targets.values()].flatMap((target) =>
            target.status === "resolved" ? target.info.variableIds : []
        )
    )
    for (const [key, target] of targets) {
        sources.set(
            key,
            target.status === "resolved"
                ? {
                      status: "resolved",
                      imageUrl: makeGrapherPreviewUrl(
                          target.info,
                          target.queryStr,
                          checksums
                      ),
                  }
                : target
        )
    }

    return sources
}
