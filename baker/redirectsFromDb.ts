import { memoize } from "lodash-es"
import * as db from "../db/db.js"
import { getRedirectsFromDb } from "../db/model/Redirect.js"

export async function getRecentGrapherRedirects(
    knex: db.KnexReadonlyTransaction
) {
    // Prevent Cloudflare from serving outdated grapher pages, which can remain
    // in the cache for up to a week. This is necessary, since we take into
    // consideration the grapher redirects only when the route returns a 404,
    // which won't be the case if the page is still cached.
    //
    // https://developers.cloudflare.com/pages/configuration/serving-pages/#asset-retention
    return await db.knexRaw<{
        source: string
        target: string
    }>(
        knex,
        `-- sql
        SELECT
            chart_slug_redirects.slug as source,
            chart_configs.slug as target
        FROM chart_slug_redirects
        INNER JOIN charts ON charts.id=chart_id
        INNER JOIN chart_configs ON chart_configs.id=charts.configId
        WHERE
            COALESCE(chart_slug_redirects.updatedAt, chart_slug_redirects.createdAt)
            > (NOW() - INTERVAL 1 WEEK)
        `
    )
}

export const getGrapherRedirectsMap = async (
    knex: db.KnexReadonlyTransaction,
    urlPrefix: string = "/grapher/"
) => {
    const chartRedirectRows = (await db.knexRaw<{
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
    )) as Array<{ oldSlug: string; newSlug: string }>

    return new Map(
        chartRedirectRows
            .filter((row) => row.oldSlug !== row.newSlug)
            .map((row) => [
                `${urlPrefix}${row.oldSlug}`,
                `${urlPrefix}${row.newSlug}`,
            ])
    )
}

export const getWordpressRedirectsMap = async (
    knex: db.KnexReadonlyTransaction
) => {
    const redirectsFromDb = await getRedirectsFromDb(knex)

    return new Map(redirectsFromDb.map((row) => [row.source, row.target]))
}

export const getGrapherAndWordpressRedirectsMap = memoize(
    async (knex: db.KnexReadonlyTransaction): Promise<Map<string, string>> => {
        // source: pathnames only (e.g. /transport)
        // target: pathnames with or without origins (e.g. /transport-new or https://ourworldindata.org/transport-new)

        const grapherRedirects = await getGrapherRedirectsMap(knex)
        const wordpressRedirects = await getWordpressRedirectsMap(knex)

        // The order the redirects are added to the map is important. Adding the
        // Wordpress redirects last means that Wordpress redirects can overwrite
        // grapher redirects.
        return new Map([...grapherRedirects, ...wordpressRedirects])
    }
)
