import * as db from "../db.js"
import {
    MultiDimDataPageConfigEnriched,
    MultiDimRedirectsTableName,
} from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"

export type MultiDimRedirectSourcePrefix = "/grapher/" | "/explorers/"

export interface MultiDimRedirectTarget {
    targetSlug: string
    queryStr?: string
}

export interface MultiDimRedirectRule {
    // Source query params that must match for this redirect to apply. An empty
    // object matches unconditionally; a `null` value acts as a wildcard for that
    // param (see QueryParamDecisionTree). Multiple rules can share a source slug.
    sourceQueryParams: Record<string, string | null>
    target: MultiDimRedirectTarget
}

export function buildQueryStrFromConfig(
    viewConfigId: string | null,
    config: string,
    multiDimSlug: string
): string | undefined {
    if (!viewConfigId) return undefined

    const parsedConfig = JSON.parse(config) as MultiDimDataPageConfigEnriched
    const mdimConfig = MultiDimDataPageConfig.fromObject(parsedConfig)
    const dimensions = mdimConfig.findViewDimensionsByConfigId(viewConfigId)
    if (!dimensions) {
        throw new Error(
            `No matching view found for viewConfigId ${viewConfigId} on multi-dim ${multiDimSlug}`
        )
    }

    const params = new URLSearchParams()
    const sortedDimensions = Object.entries(dimensions).sort(([keyA], [keyB]) =>
        keyA.localeCompare(keyB)
    )
    for (const [dimension, choice] of sortedDimensions) {
        params.set(dimension, choice)
    }
    const queryStr = params.toString()
    return queryStr || undefined
}

export async function getMultiDimRedirectTargets(
    knex: db.KnexReadonlyTransaction,
    slugs: string[] | undefined,
    sourcePrefix: MultiDimRedirectSourcePrefix
): Promise<Map<string, MultiDimRedirectTarget>> {
    const redirectMap = new Map<string, MultiDimRedirectTarget>()
    if (slugs && slugs.length === 0) return redirectMap

    let whereClause: string
    let params: string[]
    if (!slugs) {
        whereClause = "mdr.source LIKE ?"
        params = [`${sourcePrefix}%`]
    } else {
        whereClause = `mdr.source IN (${slugs.map(() => "?").join(",")})`
        params = slugs.map((slug) => `${sourcePrefix}${slug}`)
    }

    const redirects = await db.knexRaw<{
        sourceSlug: string
        multiDimSlug: string
        viewConfigId: string | null
        config: string
    }>(
        knex,
        `-- sql
        SELECT
            REPLACE(mdr.source, ?, '') as sourceSlug,
            mddp.slug as multiDimSlug,
            mdr.viewConfigId as viewConfigId,
            mddp.config as config
        FROM ${MultiDimRedirectsTableName} mdr
        JOIN multi_dim_data_pages mddp ON mddp.id = mdr.multiDimId
        WHERE mddp.published = TRUE
            AND mddp.slug IS NOT NULL
            AND ${whereClause}
        `,
        [sourcePrefix, ...params]
    )

    for (const redirect of redirects) {
        const queryStr = buildQueryStrFromConfig(
            redirect.viewConfigId,
            redirect.config,
            redirect.multiDimSlug
        )
        redirectMap.set(redirect.sourceSlug, {
            targetSlug: redirect.multiDimSlug,
            queryStr,
        })
    }

    return redirectMap
}

// Like getMultiDimRedirectTargets, but returns every matching row grouped by
// source slug (rather than one target per slug) along with the source query
// params each row is conditioned on. This is what lets a single source slug
// redirect to different targets depending on the incoming query params.
export async function getMultiDimRedirectRulesBySource(
    knex: db.KnexReadonlyTransaction,
    sourcePrefix: MultiDimRedirectSourcePrefix
): Promise<Map<string, MultiDimRedirectRule[]>> {
    const rulesBySource = new Map<string, MultiDimRedirectRule[]>()

    const redirects = await db.knexRaw<{
        sourceSlug: string
        sourceQueryParams: string | null
        multiDimSlug: string
        viewConfigId: string | null
        config: string
    }>(
        knex,
        `-- sql
        SELECT
            REPLACE(mdr.source, ?, '') as sourceSlug,
            mdr.sourceQueryParams as sourceQueryParams,
            mddp.slug as multiDimSlug,
            mdr.viewConfigId as viewConfigId,
            mddp.config as config
        FROM ${MultiDimRedirectsTableName} mdr
        JOIN multi_dim_data_pages mddp ON mddp.id = mdr.multiDimId
        WHERE mddp.published = TRUE
            AND mddp.slug IS NOT NULL
            AND mdr.source LIKE ?
        `,
        [sourcePrefix, `${sourcePrefix}%`]
    )

    for (const redirect of redirects) {
        const queryStr = buildQueryStrFromConfig(
            redirect.viewConfigId,
            redirect.config,
            redirect.multiDimSlug
        )
        const rule: MultiDimRedirectRule = {
            sourceQueryParams: parseSourceQueryParams(
                redirect.sourceQueryParams
            ),
            target: { targetSlug: redirect.multiDimSlug, queryStr },
        }
        const existing = rulesBySource.get(redirect.sourceSlug)
        if (existing) existing.push(rule)
        else rulesBySource.set(redirect.sourceSlug, [rule])
    }

    return rulesBySource
}

// Parses the JSON `sourceQueryParams` column into a condition object. Query param
// values are inherently strings, so non-null values are coerced to strings (a
// `null` value is preserved as a wildcard). Returns an empty (match-anything)
// condition when the column is null/empty.
function parseSourceQueryParams(
    raw: string | null
): Record<string, string | null> {
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const condition: Record<string, string | null> = {}
    for (const [key, value] of Object.entries(parsed)) {
        condition[key] = value === null ? null : String(value)
    }
    return condition
}

export async function getRecentMultiDimRedirects(
    knex: db.KnexReadonlyTransaction
): Promise<Array<{ source: string; target: string }>> {
    const redirects = await db.knexRaw<{
        source: string
        multiDimSlug: string
        viewConfigId: string | null
        config: string
    }>(
        knex,
        `-- sql
        SELECT
            mdr.source as source,
            mddp.slug as multiDimSlug,
            mdr.viewConfigId as viewConfigId,
            mddp.config as config
        FROM ${MultiDimRedirectsTableName} mdr
        JOIN multi_dim_data_pages mddp ON mddp.id = mdr.multiDimId
        WHERE mddp.published = TRUE
            AND mddp.slug IS NOT NULL
            AND mdr.source LIKE '/grapher/%' -- exclude explorers from here, since they have redirect rules with query params, and we don't want to generate a static redirect for them
            AND COALESCE(mdr.updatedAt, mdr.createdAt) > (NOW() - INTERVAL 1 WEEK)
        `
    )

    const result: Array<{ source: string; target: string }> = []
    for (const redirect of redirects) {
        const queryStr = buildQueryStrFromConfig(
            redirect.viewConfigId,
            redirect.config,
            redirect.multiDimSlug
        )
        const target = `/grapher/${redirect.multiDimSlug}${
            queryStr ? `?${queryStr}` : ""
        }`
        result.push({
            source: redirect.source,
            target,
        })
    }

    return result
}
