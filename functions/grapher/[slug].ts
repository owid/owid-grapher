import { IRequestStrict, Router, error } from "itty-router"
import {
    fetchCsvForGrapher,
    fetchMetadataForGrapher,
    fetchZipForGrapher,
    fetchReadmeForGrapher,
} from "../_common/grapherRenderer.js"
import { Env } from "./thumbnail/[slug].js"

enum PageType {
    grapher = "grapher",
    csv = "csv",
    metadata = "metadata",
    readme = "readme",
    zip = "zip",
}
export const onRequestGet: PagesFunction = async (context) => {
    // Makes it so that if there's an error, we will just deliver the original page before the HTML rewrite.
    // Only caveat is that redirects will not be taken into account for some reason; but on the other hand the worker is so simple that it's unlikely to fail.
    context.passThroughOnException()
    console.log(
        "prepping Handling",
        context.request.url,
        context.request.headers.get("User-Agent")
    )

    // Redirects handling is performed by the worker, and is done by fetching the (baked) _grapherRedirects.json file.
    // That file is a mapping from old slug to new slug.
    const getOptionalRedirectForSlug = async (slug: string, baseUrl: URL) => {
        const redirects: Record<string, string> = await env.ASSETS.fetch(
            new URL("/grapher/_grapherRedirects.json", baseUrl),
            { cf: { cacheTtl: 2 * 60 } }
        )
            .then((r): Promise<Record<string, string>> => r.json())
            .catch((e) => {
                console.error("Error fetching redirects", e)
                return {}
            })
        return redirects[slug]
    }

    const { request, env, params } = context
    const url = new URL(request.url)
    let pageType = PageType.grapher
    if (url.pathname.endsWith(".csv")) {
        pageType = PageType.csv
    }
    if (url.pathname.endsWith(".zip")) {
        pageType = PageType.zip
    }
    if (url.pathname.endsWith(".metadata.json")) {
        pageType = PageType.metadata
    }
    if (url.pathname.endsWith(".readme.md")) {
        // eventually this not be accessible outside the zip file
        pageType = PageType.readme
    }

    const createRedirectResponse = (redirSlug: string, currentUrl: URL) => {
        let extension = ""
        if (pageType === PageType.csv) {
            extension = ".csv"
        }
        if (pageType === PageType.zip) {
            extension = ".zip"
        }
        if (pageType === PageType.metadata) {
            extension = ".metadata.json"
        }
        if (pageType === PageType.readme) {
            extension = "readme.md"
        }
        return new Response(null, {
            status: 302,
            headers: {
                Location: `/grapher/${redirSlug}${extension}${currentUrl.search}`,
            },
        })
    }

    const originalSlug = params.slug as string

    /**
     * REDIRECTS HANDLING:
     * We want to optimize for the case where the user visits a page using the correct slug, i.e. there's no redirect.
     * That's why:
     * 1. We first check if the slug is lowercase. If it's not, we convert it to lowercase _and check for any redirects already_, and send a redirect already.
     * 2. If the slug is lowercase, we check if we can find the page at the requested slug. If we can find it, we return it already.
     * 3. If we can't find it, we _then_ check if there's a redirect for it. If there is, we redirect to the new page.
     */

    // All our grapher slugs are lowercase by convention.
    // To allow incoming links that may contain uppercase characters to work, we redirect to the lowercase version.
    const lowerCaseSlug = originalSlug.toLowerCase()
    if (lowerCaseSlug !== originalSlug) {
        const redirectSlug = await getOptionalRedirectForSlug(
            lowerCaseSlug,
            url
        )

        return createRedirectResponse(redirectSlug ?? lowerCaseSlug, url)
    }

    // For local testing
    // const grapherPageResp = await fetch(
    //     `https://ourworldindata.org/grapher/${currentSlug}`,
    //     { redirect: "manual" }
    // )

    const grapherUrl = new URL(request.url)
    // if we have a csv url, then create a new url without the csv extension but keeping the query params
    // this is to check if the page exists and to redirect to the correct page if it does
    if (pageType !== PageType.grapher) {
        if (pageType === PageType.csv) {
            grapherUrl.pathname = url.pathname.replace(/\.csv$/, "")
        }
        if (pageType === PageType.zip) {
            grapherUrl.pathname = url.pathname.replace(/\.zip$/, "")
        }
        if (pageType === PageType.metadata) {
            grapherUrl.pathname = url.pathname.replace(/\.metadata.json$/, "")
        }
        if (pageType === PageType.readme) {
            grapherUrl.pathname = url.pathname.replace(/\.readme\.md$/, "")
        }
    }

    const grapherPageResp = await env.ASSETS.fetch(grapherUrl, {
        redirect: "manual",
    })

    if (grapherPageResp.status === 404) {
        // If the request is a 404, we check if there's a redirect for it.
        // If there is, we redirect to the new page.
        const redirectSlug = await getOptionalRedirectForSlug(originalSlug, url)
        if (redirectSlug && redirectSlug !== originalSlug) {
            return createRedirectResponse(redirectSlug, url)
        } else {
            // Otherwise we just return the 404 page.
            return grapherPageResp
        }
    }

    // A non-200 status code is most likely a redirect (301 or 302) or a 404, all of which we want to pass through as-is.
    // In the case of the redirect, the browser will then request the new URL which will again be handled by this worker.
    if (grapherPageResp.status !== 200) return grapherPageResp

    const handleGrapherPage = (): Response => {
        const openGraphThumbnailUrl = `/grapher/thumbnail/${lowerCaseSlug}.png?imType=og${
            url.search ? "&" + url.search.slice(1) : ""
        }`
        const twitterThumbnailUrl = `/grapher/thumbnail/${lowerCaseSlug}.png?imType=twitter${
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
                    origin = new URL(canonicalUrl).origin
                },
            })
            .on('meta[property="og:image"]', {
                element: (element) => {
                    element.setAttribute(
                        "content",
                        origin + openGraphThumbnailUrl
                    )
                },
            })
            .on('meta[name="twitter:image"]', {
                element: (element) => {
                    element.setAttribute(
                        "content",
                        origin + twitterThumbnailUrl
                    )
                },
            })

        return rewriter.transform(grapherPageResp)
    }

    const shouldCache = !url.searchParams.has("nocache")

    const cache = caches.default
    if (shouldCache) {
        const maybeCached = await cache.match(request)
        if (maybeCached) return maybeCached
    }

    console.log("Handling", request.url, request.headers.get("User-Agent"))

    const router = Router<IRequestStrict, [URL, Env, ExecutionContext]>()
    router
        .get(
            "/grapher/:slug.csv",
            async ({ params: { slug } }, { searchParams }, env) =>
                fetchCsvForGrapher(slug, env, searchParams) // pass undefined if we want the full csv
        )
        .get(
            "/grapher/:slug.metadata.json",
            async ({ params: { slug } }, { searchParams }, env) =>
                fetchMetadataForGrapher(slug, env, searchParams) // pass undefined if we want the full csv
        )
        .get(
            "/grapher/:slug.zip",
            async ({ params: { slug } }, { searchParams }, env) =>
                fetchZipForGrapher(slug, env, searchParams) // pass undefined if we want the full csv
        )
        .get(
            "/grapher/:slug.readme.md",
            async ({ params: { slug } }, { searchParams }, env) =>
                fetchReadmeForGrapher(slug, env, searchParams) // pass undefined if we want the full csv
        )
        .get(
            "/grapher/:slug",
            async ({ params: { slug } }, { searchParams }, env) =>
                handleGrapherPage()
        )
        .all("*", () => error(404, "Route not defined"))
    return router
        .handle(request, url, { ...env, url }, context)
        .then((resp: Response) => {
            if (shouldCache) {
                resp.headers.set(
                    "Cache-Control",
                    "public, s-maxage=3600, max-age=3600"
                )
                context.waitUntil(caches.default.put(request, resp.clone()))
            } else
                resp.headers.set(
                    "Cache-Control",
                    "public, s-maxage=0, max-age=0, must-revalidate"
                )
            return resp
        })
        .catch((e) => error(500, e))
}
