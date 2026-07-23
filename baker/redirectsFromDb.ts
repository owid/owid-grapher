import * as db from "../db/db.js"
import {
    buildQueryParamDecisionTree,
    type DecisionTreeNode,
    type ExplorerRedirectTarget,
    type QueryParamMatchRule,
} from "@ourworldindata/utils"
import {
    getMultiDimRedirectRulesBySource,
    getMultiDimRedirectTargets,
} from "../db/model/MultiDimRedirects.js"

// Prevent Cloudflare from serving outdated pages, which can remain in the
// cache for up to a week. This is necessary since in the Cloudflare Functions
// we take into consideration the grapher and multi-dim redirects only when the
// route returns a 404, which won't be the case if the page is still cached.
// https://developers.cloudflare.com/pages/configuration/serving-pages/#asset-retention
export async function getRecentChartSlugRedirects(
    knex: db.KnexReadonlyTransaction
): Promise<Array<{ source: string; target: string }>> {
    return db.knexRaw<{
        source: string
        target: string
    }>(
        knex,
        `-- sql
        SELECT
            CONCAT('/grapher/', chart_slug_redirects.slug) as source,
            CONCAT(
                '/grapher/',
                chart_configs.slug,
                IF(
                    chart_slug_redirects.target_query_param IS NULL
                    OR chart_slug_redirects.target_query_param = '',
                    '',
                    CONCAT(CHAR(63), chart_slug_redirects.target_query_param) -- CHAR(63) is the question mark character, which we can't write in the SQL query because it would be interpreted as a binding
                )
            ) as target
        FROM chart_slug_redirects
        INNER JOIN charts ON charts.id=chart_id
        INNER JOIN chart_configs ON chart_configs.id=charts.configId
        WHERE
            COALESCE(chart_slug_redirects.updatedAt, chart_slug_redirects.createdAt)
            > (NOW() - INTERVAL 1 WEEK)
        `
    )
}

export const getGrapherToChartAndMultiDimRedirects = async (
    knex: db.KnexReadonlyTransaction,
    urlPrefix: string = "/grapher/"
): Promise<Map<string, string>> => {
    const grapherToChartRedirects = await getGrapherToChartRedirects(
        knex,
        urlPrefix
    )
    const grapherToMultiDimRedirects = await getGrapherToMultiDimRedirects(
        knex,
        urlPrefix
    )

    return new Map([...grapherToChartRedirects, ...grapherToMultiDimRedirects])
}

export const getGrapherToChartRedirects = async (
    knex: db.KnexReadonlyTransaction,
    urlPrefix: string = "/grapher/"
): Promise<Map<string, string>> => {
    const chartRedirectRows = await db.knexRaw<{
        oldSlug: string
        newSlug: string
        targetQueryParam: string | null
    }>(
        knex,
        `-- sql
            SELECT
                chart_slug_redirects.slug as oldSlug,
                chart_configs.slug as newSlug,
                chart_slug_redirects.target_query_param as targetQueryParam
            FROM chart_slug_redirects
            INNER JOIN charts ON charts.id=chart_id
            INNER JOIN chart_configs ON chart_configs.id=charts.configId
        `
    )

    return new Map(
        chartRedirectRows
            .filter((row) => row.oldSlug !== row.newSlug)
            .map((row) => [
                `${urlPrefix}${row.oldSlug}`,
                `${urlPrefix}${row.newSlug}${
                    row.targetQueryParam ? `?${row.targetQueryParam}` : ""
                }`,
            ])
    )
}

export const getGrapherToMultiDimRedirects = async (
    knex: db.KnexReadonlyTransaction,
    urlPrefix: string = "/grapher/"
): Promise<Map<string, string>> => {
    const redirects = new Map<string, string>()
    const targets = await getMultiDimRedirectTargets(
        knex,
        undefined,
        "/grapher/"
    )

    for (const [sourceSlug, redirect] of targets.entries()) {
        const targetPath = `${urlPrefix}${redirect.targetSlug}${
            redirect.queryStr ? `?${redirect.queryStr}` : ""
        }`
        redirects.set(`${urlPrefix}${sourceSlug}`, targetPath)
    }
    return redirects
}

// The value baked into explorers/_explorerRedirects.json for each source slug:
// either a plain target slug (the trivial unconditional case) or a query-param
// decision tree resolved at request time (see functions/_common/redirectTools.ts).
export type ExplorerRedirect = string | DecisionTreeNode<ExplorerRedirectTarget>

// Builds the explorer redirect map baked to explorers/_explorerRedirects.json,
// keyed by source slug (with `urlPrefix` prepended). A source whose single rule
// is unconditional (no source query params) and lands on a bare target slug (no
// query params to apply) is stored as a plain target-slug string; everything
// that actually depends on the incoming query params is stored as a decision tree.
export async function getExplorerRedirects(
    knex: db.KnexReadonlyTransaction,
    urlPrefix: string = "/explorers/"
): Promise<Map<string, ExplorerRedirect>> {
    const rulesBySource = await getMultiDimRedirectRulesBySource(
        knex,
        "/explorers/"
    )

    const redirects = new Map<string, ExplorerRedirect>()
    for (const [sourceSlug, rules] of rulesBySource) {
        const key = `${urlPrefix}${sourceSlug}`
        // A lone unconditional rule that lands on a bare target slug (no query
        // params to match on, none to apply) needs no decision tree — store the
        // target slug directly as a plain string.
        if (rules.length === 1) {
            const [rule] = rules
            if (
                Object.keys(rule.sourceQueryParams).length === 0 &&
                Object.keys(rule.target.targetQueryParams).length === 0
            ) {
                redirects.set(key, rule.target.targetSlug)
                continue
            }
        }
        const matchRules: QueryParamMatchRule<ExplorerRedirectTarget>[] =
            rules.map((rule) => ({
                condition: rule.sourceQueryParams,
                target: rule.target,
            }))
        redirects.set(key, buildQueryParamDecisionTree(matchRules))
    }
    return redirects
}
