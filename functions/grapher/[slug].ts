import { Env, extensions, Etag } from "../_common/env.js"
import {
    fetchCsvForGrapher,
    fetchMetadataForGrapher,
    fetchReadmeForGrapher,
    fetchZipForGrapher,
} from "../_common/fetchMetadataForGrapher.js"
import { handleThumbnailRequest } from "../_common/reusableHandlers.js"
import {
    handlePageNotFound,
    getRedirectForUrl,
} from "../_common/redirectTools.js"
import { fetchUnparsedGrapherConfig } from "../_common/grapherTools.js"
import { IRequestStrict, Router, StatusError, error, cors } from "itty-router"

const { preflight, corsify } = cors({
    allowMethods: ["GET", "OPTIONS", "HEAD"],
})

const router = Router<
    IRequestStrict,
    [URL, Env, Etag, EventContext<unknown, any, Record<string, unknown>>]
>({
    before: [preflight],
    finally: [corsify],
})
router
    .get(
        `/grapher/:slug${extensions.configJson}`,
        async ({ params: { slug } }, { searchParams }, env, etag) =>
            handleConfigRequest(slug, searchParams, env, etag)
    )
    .get(
        `/grapher/:slug${extensions.png}`,
        async ({ params: { slug } }, { searchParams }, env, etag, ctx) =>
            handleThumbnailRequest(
                { type: "slug", id: slug },
                searchParams,
                env,
                etag,
                ctx,
                "png"
            )
    )
    .get(
        `/grapher/:slug${extensions.svg}`,
        async ({ params: { slug } }, { searchParams }, env, etag, ctx) =>
            handleThumbnailRequest(
                { type: "slug", id: slug },
                searchParams,
                env,
                etag,
                ctx,
                "svg"
            )
    )
    .get(
        `/grapher/:slug${extensions.csv}`,
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchCsvForGrapher({ type: "slug", id: slug }, env, searchParams)
    )
    .get(
        `/grapher/:slug${extensions.metadata}`,
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchMetadataForGrapher(
                { type: "slug", id: slug },
                env,
                searchParams
            )
    )
    .get(
        `/grapher/:slug${extensions.readme}`,
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchReadmeForGrapher({ type: "slug", id: slug }, env, searchParams)
    )
    .get(
        `/grapher/:slug${extensions.zip}`,
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchZipForGrapher({ type: "slug", id: slug }, env, searchParams)
    )
    .get(
        "/grapher/:slug",
        async ({ params: { slug } }, { searchParams }, env) =>
            handleHtmlPageRequest(slug, searchParams, env)
    )
    .all("*", () => error(404, "Route not defined"))

export const onRequest: PagesFunction<Env> = async (context) => {
    // Makes it so that if there's an error, we will just deliver the original page before the HTML rewrite.
    // Only caveat is that redirects will not be taken into account for some reason; but on the other hand the worker is so simple that it's unlikely to fail.
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
        .catch(async (e) => {
            // Here we do a unified after the fact handling of 404s to check
            // if we have a redirect in the _grapherRedirects.json file.
            // This is done as a catch handler that checks for 404 pages
            // so that the common, happy path does not have to fetch the redirects file.
            console.log("Handling error", e)
            if (e instanceof StatusError && e.status === 404) {
                console.log("Handling 404 for", url.pathname)
                const redirect = await getRedirectForUrl(env, url)
                return redirect || error(404, "Not found")
            } else if (e instanceof StatusError) {
                return error(e.status, e.message)
            } else return error(500, e)
        })
}

async function handleHtmlPageRequest(
    slug: string,
    _searchParams: URLSearchParams,
    env: Env
) {
    const url = env.url

    // For local testing
    // const grapherPageResp = await fetch(
    //     `https://ourworldindata.org/grapher/${currentSlug}`,
    //     { redirect: "manual" }
    // )

    const grapherPageResp = await env.ASSETS.fetch(env.url, {
        redirect: "manual",
    })

    if (grapherPageResp.status === 404) {
        // grapherPageResp should be a static 404 HTML page.
        return handlePageNotFound(env, grapherPageResp)
    }

    // A non-200 status code is most likely a redirect (301 or 302), all of which we want to pass through as-is.
    // In the case of the redirect, the browser will then request the new URL which will again be handled by this worker.
    if (grapherPageResp.status !== 200) return grapherPageResp

    const openGraphThumbnailUrl = `/grapher/${slug}.png?imType=og${
        url.search ? "&" + url.search.slice(1) : ""
    }`
    const twitterThumbnailUrl = `/grapher/${slug}.png?imType=twitter${
        url.search ? "&" + url.search.slice(1) : ""
    }`

    // Take the origin (e.g. https://ourworldindata.org) from the canonical URL, which should appear before the image elements.
    // If we fail to capture the origin, we end up with relative image URLs, which should also be okay.
    let origin = ""

    // Rewrite the two meta tags that are used for a social media preview image.
    const rewriter = new HTMLRewriter()
        .on('meta[property="og:url"]', {
            // Replace canonical URL, otherwise the preview image will not include the search parameters.
            element: (element) => {
                const canonicalUrl = element.getAttribute("content")
                element.setAttribute("content", canonicalUrl + url.search)
                try {
                    origin = new URL(canonicalUrl).origin
                } catch (e) {
                    console.error("Error parsing canonical URL", e)
                }
            },
        })
        .on('meta[property="og:image"]', {
            element: (element) => {
                element.setAttribute("content", origin + openGraphThumbnailUrl)
            },
        })
        .on('meta[name="twitter:image"]', {
            element: (element) => {
                element.setAttribute("content", origin + twitterThumbnailUrl)
            },
        })

    return rewriter.transform(grapherPageResp as unknown as Response)
}

async function handleConfigRequest(
    slug: string,
    searchParams: URLSearchParams,
    env: Env,
    etag: string | undefined
) {
    const shouldCache = searchParams.get("nocache") === null
    console.log("Preparing json response for ", slug)

    const grapherPageResp = await fetchUnparsedGrapherConfig(
        { type: "slug", id: slug },
        env,
        etag
    )

    if (grapherPageResp.status === 304) {
        console.log("Returning 304 for ", slug)
        return new Response(null, { status: 304 })
    }

    if (grapherPageResp.status === 404) {
        throw new StatusError(404)
    }

    const cacheControl = shouldCache
        ? "s-maxage=3600, max-age=0, must-revalidate"
        : "no-cache"

    //grapherPageResp.headers.set("Cache-Control", cacheControl)
    return new Response(grapherPageResp.body as any, {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": cacheControl,
            ETag: grapherPageResp.headers.get("ETag") ?? "",
        },
    })
}
