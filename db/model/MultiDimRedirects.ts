import * as db from "../db.js"
import {
    ExplorerRedirectTarget,
    MultiDimDataPageConfigEnriched,
    MultiDimDimensionChoices,
    MultiDimRedirectsTableName,
} from "@ourworldindata/types"
import {
    MultiDimDataPageConfig,
    multiDimDimensionsToViewQueryStr,
} from "@ourworldindata/utils"

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
    target: ExplorerRedirectTarget
}

// Returns the dimension choices (param name -> value) of a specific multi-dim
// view, or an empty object when no view is specified (the multi-dim's default
// view). Throws if a view config id is given but no matching view exists.
export function getViewParamsFromConfig(
    viewConfigId: string | null,
    config: MultiDimDataPageConfigEnriched,
    multiDimSlug: string
): MultiDimDimensionChoices {
    if (!viewConfigId) return {}
    const dimensions =
        MultiDimDataPageConfig.fromObject(config).findViewDimensionsByConfigId(
            viewConfigId
        )
    if (!dimensions) throw noMatchingViewError(viewConfigId, multiDimSlug)
    return dimensions
}

export function buildQueryStrFromConfig(
    viewConfigId: string | null,
    config: MultiDimDataPageConfigEnriched,
    multiDimSlug: string
): string | undefined {
    return viewQueryStr(
        getViewParamsFromConfig(viewConfigId, config, multiDimSlug)
    )
}

// The path a redirect to a multi-dim view lands on, e.g.
// `/grapher/energy?metric=total&source=all`.
export function buildRedirectTargetPath(
    multiDimSlug: string,
    dimensions: MultiDimDimensionChoices
): string {
    const queryStr = viewQueryStr(dimensions)
    return `/grapher/${multiDimSlug}${queryStr ? `?${queryStr}` : ""}`
}

// The view's canonical query string, the same one the multi-dim's baked views
// and the Cloudflare functions use, or undefined for the default view.
function viewQueryStr(
    dimensions: MultiDimDimensionChoices
): string | undefined {
    return multiDimDimensionsToViewQueryStr(dimensions) || undefined
}

function noMatchingViewError(
    viewConfigId: string,
    multiDimSlug: string
): Error {
    return new Error(
        `No matching view found for viewConfigId ${viewConfigId} on multi-dim ${multiDimSlug}`
    )
}

// Joins a redirect `mdr` to its target view's dimensions, to select as
// `mdvd.dimensions AS viewDimensions` and read with parseViewDimensions. Going
// through multi_dim_x_chart_configs limits the view to the redirect's own
// multi-dim's current views. Reading the dimensions from here rather than from
// the multi-dim's config keeps configs, which can be several MB and shared by
// thousands of redirects, out of redirect queries.
export const VIEW_DIMENSIONS_JOIN = `
    LEFT JOIN multi_dim_x_chart_configs mdxcc
        ON mdxcc.multiDimId = mdr.multiDimId
        AND mdxcc.chartConfigId = mdr.viewConfigId
    LEFT JOIN multi_dim_view_dimensions mdvd
        ON mdvd.chartConfigId = mdxcc.chartConfigId`

// The dimensions of a redirect's target view, from a row selected with
// VIEW_DIMENSIONS_JOIN, or none for the multi-dim's default view. Throws if
// the view isn't one of the multi-dim's current views.
export function parseViewDimensions(row: {
    viewConfigId: string | null
    viewDimensions: string | null
    multiDimSlug: string
}): MultiDimDimensionChoices {
    if (!row.viewConfigId) return {}
    if (!row.viewDimensions) {
        throw noMatchingViewError(row.viewConfigId, row.multiDimSlug)
    }
    return JSON.parse(row.viewDimensions) as MultiDimDimensionChoices
}

// One representative target per source slug, for callers that resolve by slug
// alone. The query-param matching itself happens at request time in the
// Cloudflare function, from getMultiDimRedirectRulesBySource.
export async function getMultiDimRedirectTargets(
    knex: db.KnexReadonlyTransaction,
    slugs: string[] | undefined,
    sourcePrefix: MultiDimRedirectSourcePrefix
): Promise<Map<string, MultiDimRedirectTarget>> {
    const rulesBySource = await getMultiDimRedirectRulesBySource(
        knex,
        sourcePrefix,
        slugs
    )
    const targets = new Map<string, MultiDimRedirectTarget>()
    for (const [sourceSlug, rules] of rulesBySource) {
        // Prefer the unconditional (catch-all) rule, so the representative
        // view is the default, else the oldest rule (rules come in id order).
        const rule =
            rules.find(
                (rule) => Object.keys(rule.sourceQueryParams).length === 0
            ) ?? rules[0]
        const { targetSlug, targetQueryParams } = rule.target
        // A null param only tells the redirect function to drop that source
        // param; the rest are the target view's dimensions.
        const viewParams: MultiDimDimensionChoices = {}
        for (const [key, value] of Object.entries(targetQueryParams)) {
            if (value !== null) viewParams[key] = value
        }
        targets.set(sourceSlug, {
            targetSlug,
            queryStr: viewQueryStr(viewParams),
        })
    }
    return targets
}

// Returns, for the given source slugs, those that resolve to more than one
// distinct target multi-dim depending on their source query params, mapped to
// the sorted list of target slugs. getMultiDimRedirectTargets collapses each
// source to a single representative target, so callers that resolve by slug
// alone (without query-param matching, e.g. the gdoc link layer) use this to
// detect the sources they would mis-resolve.
export async function getMultiDimRedirectSourcesWithMultipleTargets(
    knex: db.KnexReadonlyTransaction,
    slugs: string[],
    sourcePrefix: MultiDimRedirectSourcePrefix
): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>()
    if (slugs.length === 0) return result

    const rows = await db.knexRaw<{ sourceSlug: string; targetSlugs: string }>(
        knex,
        `-- sql
        SELECT
            REPLACE(mdr.source, ?, '') AS sourceSlug,
            GROUP_CONCAT(DISTINCT mddp.slug ORDER BY mddp.slug) AS targetSlugs
        FROM ${MultiDimRedirectsTableName} mdr
        JOIN multi_dim_data_pages mddp ON mddp.id = mdr.multiDimId
        WHERE mddp.published = TRUE
            AND mddp.slug IS NOT NULL
            AND mdr.source IN (${slugs.map(() => "?").join(",")})
        GROUP BY mdr.source
        HAVING COUNT(DISTINCT mdr.multiDimId) > 1
        `,
        [sourcePrefix, ...slugs.map((slug) => `${sourcePrefix}${slug}`)]
    )
    for (const row of rows) {
        result.set(row.sourceSlug, row.targetSlugs.split(","))
    }
    return result
}

// Like getMultiDimRedirectTargets, but returns every matching row grouped by
// source slug (rather than one target per slug) along with the source query
// params each row is conditioned on. This is what lets a single source slug
// redirect to different targets depending on the incoming query params.
export async function getMultiDimRedirectRulesBySource(
    knex: db.KnexReadonlyTransaction,
    sourcePrefix: MultiDimRedirectSourcePrefix,
    // Only the rules for these source slugs; all of them when omitted
    slugs?: string[]
): Promise<Map<string, MultiDimRedirectRule[]>> {
    const rulesBySource = new Map<string, MultiDimRedirectRule[]>()
    if (slugs && slugs.length === 0) return rulesBySource

    // Deterministic order so that, when two same-specificity rules overlap for
    // a source, buildQueryParamDecisionTree breaks the tie the same way on
    // every bake (it uses input order).
    const redirects = await db.knexRaw<{
        sourceSlug: string
        sourceQueryParams: string | null
        multiDimSlug: string
        viewConfigId: string | null
        viewDimensions: string | null
    }>(
        knex,
        `-- sql
        SELECT
            REPLACE(mdr.source, ?, '') as sourceSlug,
            mdr.sourceQueryParams as sourceQueryParams,
            mddp.slug as multiDimSlug,
            mdr.viewConfigId as viewConfigId,
            mdvd.dimensions as viewDimensions
        FROM ${MultiDimRedirectsTableName} mdr
        JOIN multi_dim_data_pages mddp ON mddp.id = mdr.multiDimId
        ${VIEW_DIMENSIONS_JOIN}
        WHERE mddp.published = TRUE
            AND mddp.slug IS NOT NULL
            AND ${
                slugs
                    ? `mdr.source IN (${slugs.map(() => "?").join(",")})`
                    : "mdr.source LIKE ?"
            }
        ORDER BY mdr.id
        `,
        [
            sourcePrefix,
            ...(slugs
                ? slugs.map((slug) => `${sourcePrefix}${slug}`)
                : [`${sourcePrefix}%`]),
        ]
    )

    for (const redirect of redirects) {
        const sourceQueryParams = parseSourceQueryParams(
            redirect.sourceQueryParams
        )
        const viewParams = parseViewDimensions(redirect)
        const rule: MultiDimRedirectRule = {
            sourceQueryParams,
            target: {
                targetSlug: redirect.multiDimSlug,
                targetQueryParams: buildTargetQueryParams(
                    sourceQueryParams,
                    viewParams
                ),
            },
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
export function parseSourceQueryParams(
    raw: string | null
): Record<string, string | null> {
    // Null-prototype object so param names coming from stored JSON (e.g.
    // "__proto__") can't pollute the prototype chain.
    const condition: Record<string, string | null> = Object.create(null)
    if (!raw) return condition
    const parsed: unknown = JSON.parse(raw)
    // Guard against JSON that isn't a plain object (null, arrays, primitives),
    // which would make Object.entries throw or produce nonsense keys.
    if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
    ) {
        return condition
    }
    for (const [key, value] of Object.entries(parsed)) {
        condition[key] = value === null ? null : String(value)
    }
    return condition
}

// Builds the query params to apply to the redirect target. Every param the
// target multi-dim view sets is applied (so the redirect always lands on that
// view). Additionally, any source query param that was matched on but that the
// target view doesn't constrain is mapped to `null` (a signal to remove the
// param from the outgoing URL), since it's explorer-specific and shouldn't leak
// into the grapher URL.
function buildTargetQueryParams(
    sourceQueryParams: Record<string, string | null>,
    viewParams: MultiDimDimensionChoices
): Record<string, string | null> {
    // Null-prototype object: keys can originate from user-controlled source
    // query params, so avoid any "__proto__"-style prototype pollution.
    const targetQueryParams: Record<string, string | null> = Object.create(null)
    for (const key of Object.keys(viewParams).sort()) {
        targetQueryParams[key] = viewParams[key]
    }
    for (const key of Object.keys(sourceQueryParams).sort()) {
        if (!Object.hasOwn(viewParams, key)) {
            targetQueryParams[key] = null
        }
    }
    return targetQueryParams
}

export async function getRecentMultiDimRedirects(
    knex: db.KnexReadonlyTransaction
): Promise<Array<{ source: string; target: string }>> {
    const redirects = await db.knexRaw<{
        source: string
        multiDimSlug: string
        viewConfigId: string | null
        viewDimensions: string | null
    }>(
        knex,
        `-- sql
        SELECT
            mdr.source as source,
            mddp.slug as multiDimSlug,
            mdr.viewConfigId as viewConfigId,
            mdvd.dimensions as viewDimensions
        FROM ${MultiDimRedirectsTableName} mdr
        JOIN multi_dim_data_pages mddp ON mddp.id = mdr.multiDimId
        ${VIEW_DIMENSIONS_JOIN}
        WHERE mddp.published = TRUE
            AND mddp.slug IS NOT NULL
            AND mdr.source LIKE '/grapher/%' -- exclude explorers from here, since they have redirect rules with query params, and we don't want to generate a static redirect for them
            AND COALESCE(mdr.updatedAt, mdr.createdAt) > (NOW() - INTERVAL 1 WEEK)
        `
    )

    return redirects.map((redirect) => ({
        source: redirect.source,
        target: buildRedirectTargetPath(
            redirect.multiDimSlug,
            parseViewDimensions(redirect)
        ),
    }))
}
