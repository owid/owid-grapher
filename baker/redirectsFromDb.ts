import * as db from "../db/db.js"
import { getMultiDimRedirectTargets } from "../db/model/MultiDimRedirects.js"

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

export async function getExplorerToMultiDimRedirects(
    knex: db.KnexReadonlyTransaction,
    urlPrefix: string = "/explorers/"
): Promise<Map<string, string>> {
    const redirects = new Map<string, string>()
    const targets = await getMultiDimRedirectTargets(
        knex,
        undefined,
        "/explorers/"
    )

    for (const [sourceSlug, redirect] of targets.entries()) {
        const targetPath = `/grapher/${redirect.targetSlug}${
            redirect.queryStr ? `?${redirect.queryStr}` : ""
        }`
        redirects.set(`${urlPrefix}${sourceSlug}`, targetPath)
    }
    return redirects
}
