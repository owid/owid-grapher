import * as db from "../db/db.js"
import * as wpdb from "../db/wpdb.js"
import { getCountryDetectionRedirects } from "../clientUtils/countries.js"
import { memoize } from "../clientUtils/Util.js"
import { isCanonicalInternalUrl } from "./formatting.js"
import { resolveExplorerRedirect } from "./replaceExplorerRedirects.js"
import { Url } from "../clientUtils/urls/Url.js"
import { logContentErrorAndMaybeSendToSlack } from "../serverUtils/slackLog.js"

export const getRedirects = async () => {
    const redirects = [
        // RSS feed
        "/feed /atom.xml 302!",

        // Backwards compatibility-- admin urls
        "/wp-admin/* https://owid.cloud/wp/wp-admin/:splat 301",
        "/grapher/admin/* https://owid.cloud/grapher/admin/:splat 301",

        // TODO: this should only get triggered by external hits (indexed .pdf files for instance)
        // and should be removed when no evidence of these inbound links can be found.
        "/wp-content/uploads/* /uploads/:splat 301",
        // TODO: temporary fix for the /blog page thumbnails, which paths are not being
        // transformed through the formatting step. Potentially applies to other
        // pages as well.
        "/app/uploads/* /uploads/:splat 301",

        // Backwards compatibility-- old Max stuff that isn't static-friendly
        "/roser/* https://www.maxroser.com/roser/:splat 301",
        "/uploads/nvd3/* https://www.maxroser.com/owidUploads/nvd3/:splat 301",
        "/uploads/datamaps/* https://www.maxroser.com/owidUploads/datamaps/:splat 301",
        "/slides/Max_PPT_presentations/* https://www.maxroser.com/slides/Max_PPT_presentations/:splat 301",
        "/slides/Max_Interactive_Presentations/* https://www.maxroser.com/slides/Max_Interactive_Presentations/:splat 301",

        // Backwards compatibility-- public urls
        "/entries/* /:splat 301",
        "/entries /#entries 302",
        "/data/food-agriculture/* /:splat 301",
        "/data/political-regimes/* /:splat 301",
        "/data/population-growth-vital-statistics/* /:splat 301",
        "/data/growth-and-distribution-of-prosperity/* /:splat 301",

        // Backwards compatibility-- grapher url style
        "/chart-builder/* /grapher/:splat 301",
        "/grapher/public/* /grapher/:splat 301",
        "/grapher/view/* /grapher/:splat 301",

        "/slides/* https://slides.ourworldindata.org/:splat 301",
        "/subscribe /#subscribe 301",
    ]

    getCountryDetectionRedirects().forEach((redirect) =>
        redirects.push(redirect)
    )

    // Redirects from Wordpress admin UI
    const rows = await wpdb.singleton.query(
        `SELECT url, action_data, action_code FROM wp_redirection_items WHERE status = 'enabled'`
    )
    redirects.push(
        ...rows.map(
            (row) =>
                `${row.url.replace(/__/g, "/")} ${row.action_data.replace(
                    /__/g,
                    "/"
                )} ${row.action_code}!`
        )
    )

    // Redirect old slugs to new slugs
    const chartRedirectRows = await db.queryMysql(`
    SELECT chart_slug_redirects.slug, chart_id, JSON_EXTRACT(charts.config, "$.slug") as trueSlug
    FROM chart_slug_redirects INNER JOIN charts ON charts.id=chart_id
`)

    for (const row of chartRedirectRows) {
        const trueSlug = JSON.parse(row.trueSlug)
        if (row.slug !== trueSlug) {
            redirects.push(`/grapher/${row.slug} /grapher/${trueSlug} 302!`)
        }
    }

    return redirects
}

export const getGrapherAndWordpressRedirectsMap = memoize(
    async (): Promise<Map<string, string>> => {
        // source: pathnames only (e.g. /transport)
        // target: pathnames with or without origins (e.g. /transport-new or https://ourworldindata.org/transport-new)
        const redirects = new Map()

        // todo(refactor): export as function to reuse in getRedirects?
        const chartRedirectRows = await db.queryMysql(`
        SELECT chart_slug_redirects.slug, JSON_EXTRACT(charts.config, "$.slug") as trueSlug
        FROM chart_slug_redirects INNER JOIN charts ON charts.id=chart_id
    `)

        // todo(refactor) : export as function to reuse in getRedirects?
        const wordpressRedirectRows = await wpdb.singleton.query(
            `SELECT url, action_data FROM wp_redirection_items WHERE status = 'enabled'`
        )

        // The order the redirects are added to the map is important. Adding the
        // Wordpress redirects last means that Wordpress redirects can overwrite
        // grapher redirects.
        for (const row of chartRedirectRows) {
            const trueSlug = JSON.parse(row.trueSlug)
            if (row.slug !== trueSlug) {
                redirects.set(`/grapher/${row.slug}`, `/grapher/${trueSlug}`)
            }
        }

        for (const row of wordpressRedirectRows) {
            redirects.set(row.url, row.action_data)
        }

        return redirects
    }
)

export const resolveGrapherAndWordpressRedirect = async (
    url: Url
): Promise<Url> => {
    const MAX_RECURSION_DEPTH = 25
    let recursionDepth = 0
    const originalUrl = url

    const _resolveGrapherAndWordpressRedirect = async (
        url: Url
    ): Promise<Url> => {
        ++recursionDepth
        if (recursionDepth > MAX_RECURSION_DEPTH) {
            logContentErrorAndMaybeSendToSlack(
                `A circular redirect (/a -> /b -> /a) has been detected for ${originalUrl.pathname} and is ignored.`
            )
            return originalUrl
        }

        if (!url.pathname || !isCanonicalInternalUrl(url)) return url

        const redirects = await getGrapherAndWordpressRedirectsMap()
        const target = redirects.get(url.pathname)

        if (!target) return url
        const targetUrl = Url.fromURL(target)

        if (targetUrl.pathname === url.pathname) {
            logContentErrorAndMaybeSendToSlack(
                `A self redirect (/a -> /a) has been detected for ${originalUrl.pathname} and is ignored.`
            )
            return originalUrl
        }

        return _resolveGrapherAndWordpressRedirect(
            // Pass query params through only if none present on the target (cf.
            // netlify behaviour)
            url.queryStr && !targetUrl.queryStr
                ? targetUrl.setQueryParams(url.queryParams)
                : targetUrl
        )
    }
    return _resolveGrapherAndWordpressRedirect(url)
}

export const resolveInternalRedirect = async (url: Url): Promise<Url> => {
    if (!isCanonicalInternalUrl(url)) return url

    // Assumes that redirects in explorer code are final (in line with the
    // current expectation). This helps keeping complexity at bay, while
    // avoiding unnecessary processing.

    // In other words, in the following hypothetical redirect chain:
    // (1) wordpress redirect: /omicron --> /explorers/omicron
    // (2) wordpress redirect: /explorers/omicron --> /grapher/omicron
    // (3) grapher admin redirect: /grapher/omicron --> /grapher/omicron-v1
    // (4) wordpress redirect: /grapher/omicron-v1 --> /grapher/omicron-v2
    // (5) explorer code redirect: /grapher/omicron-v2 --> /explorers/coronavirus-data-explorer?omicron=true
    // --- END OF REDIRECTS ---
    // (6) wordpress redirect: /explorers/coronavirus-data-explorer --> /explorers/covid

    // - The last redirect (6) is not executed because is comes after a redirect
    //   stored in explorer code.
    // - If a /grapher/omicron-v2 --> /grapher/omicron-v3 were to be defined in
    //   wordpress (or grapher admin), it would be resolved before (5), and (5)
    //   would never execute.
    // - (2) does not block the redirects chain. Even though an explorer URL is
    //   redirected, what matters here is where the redirect is stored
    //   (wordpress), not what is redirected.

    return resolveExplorerRedirect(
        await resolveGrapherAndWordpressRedirect(url)
    )
}

export const flushCache = () => {
    getGrapherAndWordpressRedirectsMap.cache.clear?.()
}
