import * as _ from "lodash-es"
import * as db from "../db/db.js"
import { getSiteRedirects } from "../db/model/Redirect.js"
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
            CONCAT('/grapher/', chart_configs.slug) as target
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
    }>(
        knex,
        `-- sql
            SELECT chart_slug_redirects.slug as oldSlug, chart_configs.slug as newSlug
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
                `${urlPrefix}${row.newSlug}`,
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

    for (const [sourceSlug, target] of targets.entries()) {
        const targetPath = `${urlPrefix}${target.targetSlug}${
            target.queryStr ? `?${target.queryStr}` : ""
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

    for (const [sourceSlug, target] of targets.entries()) {
        const targetPath = `/grapher/${target.targetSlug}${
            target.queryStr ? `?${target.queryStr}` : ""
        }`
        redirects.set(`${urlPrefix}${sourceSlug}`, targetPath)
    }
    return redirects
}

export const DEPRECATED_getSiteRedirectsMap = async (
    knex: db.KnexReadonlyTransaction
) => {
    const siteRedirects = await getSiteRedirects(knex)

    return new Map(siteRedirects.map((row) => [row.source, row.target]))
}

export const DEPRECATED_getAllRedirectsMap = _.memoize(
    async (knex: db.KnexReadonlyTransaction): Promise<Map<string, string>> => {
        // source: pathnames only (e.g. /transport)
        // target: pathnames with or without origins (e.g. /transport-new or https://ourworldindata.org/transport-new)

        const grapherRedirects =
            await getGrapherToChartAndMultiDimRedirects(knex)
        const explorerRedirects = await getExplorerToMultiDimRedirects(knex)
        const siteRedirects = await DEPRECATED_getSiteRedirectsMap(knex)

        // The order matters: site redirects can override both grapher and
        // explorer redirects.
        return new Map([
            ...grapherRedirects,
            ...explorerRedirects,
            ...siteRedirects,
        ])
    }
)
