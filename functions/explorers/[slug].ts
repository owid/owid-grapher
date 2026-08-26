import { Env, Etag, extensions } from "../_common/env.js"
import { getRedirectForExplorerUrl } from "../_common/redirectTools.js"
import { IRequestStrict, Router, StatusError, error, cors } from "itty-router"
import { rewriteMetaTags } from "../_common/grapherTools.js"
import {
    fetchCsvForExplorerView,
    fetchDataValuesForExplorerView,
    fetchMetadataForExplorerView,
    fetchReadmeForExplorerView,
    fetchSearchResultDataForExplorerView,
    fetchZipForExplorerView,
    handleConfigRequestForExplorerView,
    handleThumbnailRequestForExplorerView,
} from "../_common/explorerHandlers.js"

const { preflight, corsify } = cors({
    allowMethods: ["GET", "OPTIONS", "HEAD"],
})

// An explorer redirect can be conditional on the incoming query params, AND we can't use the "put it into _redirects for one week" approach we do for other redirects, because we need to handle query params always.
// So instead, we check for redirects _for every incoming request_, unlike what we do for charts where we only check when the initial request is 404-ing.
async function checkForRedirect(
    _request: IRequestStrict,
    url: URL,
    env: Env
): Promise<Response | undefined> {
    return getRedirectForExplorerUrl(env, url)
}

const router = Router<
    IRequestStrict,
    [URL, Env, Etag, EventContext<unknown, any, Record<string, unknown>>]
>({
    before: [preflight, checkForRedirect],
    finally: [corsify],
})
router
    .get(
        `/explorers/:slug${extensions.configJson}`,
        async (_, { searchParams }, env) => {
            console.log("Handling explorer config request")
            return handleConfigRequestForExplorerView(searchParams, env)
        }
    )
    .get(
        `/explorers/:slug${extensions.svg}`,
        async (_, { searchParams }, env) => {
            console.log("Handling explorer SVG thumbnail request")
            return handleThumbnailRequestForExplorerView(
                searchParams,
                env,
                "svg"
            )
        }
    )
    .get(
        `/explorers/:slug${extensions.png}`,
        async (_, { searchParams }, env) => {
            console.log("Handling explorer PNG thumbnail request")
            return handleThumbnailRequestForExplorerView(
                searchParams,
                env,
                "png"
            )
        }
    )
    .get(
        `/explorers/:slug${extensions.csv}`,
        async (_, { searchParams }, env) => {
            console.log("Handling explorer CSV request")
            return fetchCsvForExplorerView(searchParams, env)
        }
    )
    .get(
        `/explorers/:slug${extensions.metadata}`,
        async (_, { searchParams }, env) => {
            console.log("Handling explorer metadata request")
            return fetchMetadataForExplorerView(searchParams, env)
        }
    )
    .get(
        `/explorers/:slug${extensions.readme}`,
        async (_, { searchParams }, env) => {
            console.log("Handling explorer README request")
            return fetchReadmeForExplorerView(searchParams, env)
        }
    )
    .get(
        `/explorers/:slug${extensions.zip}`,
        async (_, { searchParams }, env) => {
            console.log("Handling explorer ZIP request")
            return fetchZipForExplorerView(searchParams, env)
        }
    )
    .get(
        `/explorers/:slug${extensions.values}`,
        async (_, { searchParams }, env, _etag, ctx) => {
            console.log("Handling explorer values request")
            return fetchDataValuesForExplorerView(searchParams, env, ctx)
        }
    )
    .get(
        `/explorers/:slug${extensions.searchResult}`,
        async (_, { searchParams }, env, _etag, ctx) => {
            console.log("Handling explorer search result data request")
            return fetchSearchResultDataForExplorerView(searchParams, env, ctx)
        }
    )
    .get(
        "/explorers/:slug",
        async ({ params: { slug } }, { searchParams }, env) => {
            console.log("Handling explorer HTML page request")
            return handleHtmlPageRequest(slug, searchParams, env)
        }
    )
    .all("*", () => error(404, "Route not defined"))

async function handleHtmlPageRequest(
    slug: string,
    _searchParams: URLSearchParams,
    env: Env
) {
    const url = env.url

    const explorerPage = await env.ASSETS.fetch(url, {
        redirect: "manual",
    })

    // Redirects have already been checked in `checkForRedirect`, so a 404 here
    // is a genuine 404: pass the static 404 page through as-is.
    if (explorerPage.status === 404) return explorerPage

    const openGraphThumbnailUrl = `/explorers/${slug}.png?imType=og${
        url.search ? "&" + url.search.slice(1) : ""
    }`
    const twitterThumbnailUrl = `/explorers/${slug}.png?imType=twitter${
        url.search ? "&" + url.search.slice(1) : ""
    }`

    const explorerPageWithUpdatedMetaTags = rewriteMetaTags(
        url,
        openGraphThumbnailUrl,
        twitterThumbnailUrl,
        explorerPage
    )

    return explorerPageWithUpdatedMetaTags
}

export const onRequest: PagesFunction<Env> = async (context) => {
    context.passThroughOnException()
    const { request, env } = context
    const url = new URL(request.url)

    return router
        .fetch(
            request,
            url,
            { ...env, url },
            request.headers.get("if-none-match"),
            context
        )
        .catch((e) => {
            console.log("Handling error", e)
            if (e instanceof StatusError) return error(e.status, e.message)
            return error(500, e)
        })
}
