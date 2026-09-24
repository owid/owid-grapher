import crypto from "crypto"
import { Url } from "@ourworldindata/utils"
import { GDOCS_CHART_PREVIEW_GRAPHER_URL } from "../../../../settings/serverSettings.js"
import * as db from "../../../db.js"
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

export async function resolveChartPreviewSources(
    knex: db.KnexReadonlyTransaction,
    specs: ChartPreviewComponentSpec[]
): Promise<Map<string, ChartPreviewSource>> {
    const sources = new Map<string, ChartPreviewSource>()
    const grapherSpecs: { key: string; slug: string; queryStr: string }[] = []

    for (const spec of specs) {
        const key = chartPreviewSpecKey(spec)
        if (sources.has(key)) continue
        const url = Url.fromURL(spec.target)
        if (url.isGrapher && url.slug) {
            grapherSpecs.push({ key, slug: url.slug, queryStr: url.queryStr })
            // Placeholder until resolved below, also dedupes
            sources.set(key, {
                status: "unresolved",
                message: "No chart with this slug",
            })
        } else {
            sources.set(key, {
                status: "unresolved",
                message: "Not a link to a grapher chart",
            })
        }
    }

    const configsBySlug = await getChartConfigsBySlug(
        knex,
        grapherSpecs.map((spec) => spec.slug)
    )
    const checksums = await getVariableChecksums(
        knex,
        [...configsBySlug.values()].flatMap((info) => info.variableIds)
    )
    for (const { key, slug, queryStr } of grapherSpecs) {
        const info = configsBySlug.get(slug)
        if (!info) continue
        sources.set(key, {
            status: "resolved",
            imageUrl: makeGrapherPreviewUrl(info, queryStr, checksums),
        })
    }

    return sources
}
