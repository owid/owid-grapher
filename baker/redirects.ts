import * as db from "../db/db.js"
import { memoize, JsonError, Url } from "@ourworldindata/utils"
import { isCanonicalInternalUrl } from "./formatting.js"
import { resolveExplorerRedirect } from "./replaceExplorerRedirects.js"
import { logErrorAndMaybeSendToBugsnag } from "../serverUtils/errorLog.js"
import { getRedirectsFromDb } from "../db/model/Redirect.js"

export const getRedirects = async (knex: db.KnexReadonlyTransaction) => {
    const staticRedirects = [
        // RSS feed
        "/feed /atom.xml 302",

        // Entries and blog (we should keep these for a while)
        "/entries / 302",
        "/blog /latest 301",
        "/subscribe /#subscribe 301",

        // Country detection
        "/detect-country https://detect-country.owid.io 302",
    ]

    // Dynamic redirects are all redirects that contain an asterisk
    const dynamicRedirects = [
        // Always remove trailing slash
        "/*/ /:splat 301",

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

        // Entries and blog (we should keep these for a while)
        "/entries/* /:splat 301",
        "/blog/* /latest/:splat 301",

        // Backwards compatibility-- grapher url style
        "/chart-builder/* /grapher/:splat 301",
        "/grapher/public/* /grapher/:splat 301",
        "/grapher/view/* /grapher/:splat 301",

        // Slides
        "/slides/* https://slides.ourworldindata.org/:splat 301",

        // These are needed for the Cloudflare Pages migration
        "/uploads/* https://assets.ourworldindata.org/uploads/:splat 301",
        "/exports/* https://assets.ourworldindata.org/exports/:splat 301",
        "/grapher/exports/* https://assets.ourworldindata.org/grapher/exports/:splat 301",
    ]

    // Get redirects from the database (exported from the Wordpress DB)
    // Redirects are assumed to be trailing-slash-free (see syncRedirectsToGrapher.ts)
    const redirectsFromDb = (await getRedirectsFromDb(knex)).map(
        (row) => `${row.source} ${row.target} ${row.code}`
    )

    // Add newlines in between so we get some more overview
    return [
        ...staticRedirects,
        "",
        ...redirectsFromDb,
        "",
        ...dynamicRedirects, // Cloudflare requires all dynamic redirects to be at the very end of the _redirects file
    ]
}

export const getGrapherRedirectsMap = async (
    urlPrefix: string = "/grapher/"
) => {
    const chartRedirectRows = (await db.queryMysql(`-- sql
        SELECT chart_slug_redirects.slug as oldSlug, charts.config ->> "$.slug" as newSlug
        FROM chart_slug_redirects INNER JOIN charts ON charts.id=chart_id
    `)) as Array<{ oldSlug: string; newSlug: string }>

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

        const grapherRedirects = await getGrapherRedirectsMap()
        const wordpressRedirects = await getWordpressRedirectsMap(knex)

        // The order the redirects are added to the map is important. Adding the
        // Wordpress redirects last means that Wordpress redirects can overwrite
        // grapher redirects.
        return new Map([...grapherRedirects, ...wordpressRedirects])
    }
)

export const resolveRedirectFromMap = async (
    url: Url,
    redirectsMap: Map<string, string>
): Promise<Url> => {
    const MAX_RECURSION_DEPTH = 25
    let recursionDepth = 0
    const originalUrl = url

    const _resolveRedirectFromMap = async (url: Url): Promise<Url> => {
        ++recursionDepth
        if (recursionDepth > MAX_RECURSION_DEPTH) {
            logErrorAndMaybeSendToBugsnag(
                new JsonError(
                    `A circular redirect (/a -> /b -> /a) has been detected for ${originalUrl.pathname} and is ignored.`
                )
            )
            return originalUrl
        }

        if (!url.pathname || !isCanonicalInternalUrl(url)) return url

        const target = redirectsMap.get(url.pathname)

        if (!target) return url
        const targetUrl = Url.fromURL(target)

        if (targetUrl.pathname === url.pathname) {
            logErrorAndMaybeSendToBugsnag(
                new JsonError(
                    `A self redirect (/a -> /a) has been detected for ${originalUrl.pathname} and is ignored.`
                )
            )
            return originalUrl
        }

        return _resolveRedirectFromMap(
            // Pass query params through only if none present on the target (cf.
            // netlify behaviour)
            url.queryStr && !targetUrl.queryStr
                ? targetUrl.setQueryParams(url.queryParams)
                : targetUrl
        )
    }
    return _resolveRedirectFromMap(url)
}

export const resolveInternalRedirect = async (
    url: Url,
    knex: db.KnexReadonlyTransaction
): Promise<Url> => {
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
        await resolveRedirectFromMap(
            url,
            await getGrapherAndWordpressRedirectsMap(knex)
        )
    )
}

export const flushCache = () => {
    getGrapherAndWordpressRedirectsMap.cache.clear?.()
}
