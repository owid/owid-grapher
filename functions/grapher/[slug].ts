import { Env } from "./thumbnail/[slug].js"
import {
    fetchGrapherConfig,
    getOptionalRedirectForSlug,
    createRedirectResponse,
} from "../_common/grapherRenderer.js"
import { IRequestStrict, Router, error } from "itty-router"

const router = Router<IRequestStrict, [URL, Env]>()
router
    .get(
        "/grapher/:slug.config.json",
        async ({ params: { slug } }, { searchParams }, env: Env) =>
            handleConfigRequest(slug, searchParams, env)
    )
    .get(
        "/grapher/:slug",
        async ({ params: { slug } }, { searchParams }, env: Env) =>
            handleHtmlPageRequest(slug, searchParams, env)
    )
    .all("*", () => error(404, "Route not defined"))

export const onRequestGet: PagesFunction = async (context) => {
    // Makes it so that if there's an error, we will just deliver the original page before the HTML rewrite.
    // Only caveat is that redirects will not be taken into account for some reason; but on the other hand the worker is so simple that it's unlikely to fail.
    context.passThroughOnException()
    console.log("handlings request", context.request.url)
    const { request, env, params } = context
    const url = new URL(request.url)

    return (
        router
            .fetch(request, url, { ...env, url }, context)
            // .then((resp: Response) => {
            //     if (shouldCache) {
            //         resp.headers.set(
            //             "Cache-Control",
            //             "public, s-maxage=3600, max-age=3600"
            //         )
            //         context.waitUntil(caches.default.put(request, resp.clone()))
            //     } else
            //         resp.headers.set(
            //             "Cache-Control",
            //             "public, s-maxage=0, max-age=0, must-revalidate"
            //         )
            //     return resp
            // })
            .catch((e) => error(500, e))
    )
}

async function handleHtmlPageRequest(
    slug: string,
    searchParams: URLSearchParams,
    env: Env
) {
    const url = env.url
    console.log("processing", url)
    // Redirects handling is performed by the worker, and is done by fetching the (baked) _grapherRedirects.json file.
    // That file is a mapping from old slug to new slug.

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
    const lowerCaseSlug = slug.toLowerCase()
    if (lowerCaseSlug !== slug) {
        const redirectSlug = await getOptionalRedirectForSlug(
            lowerCaseSlug,
            url,
            env
        )

        return createRedirectResponse(redirectSlug ?? lowerCaseSlug, url)
    }

    // For local testing
    // const grapherPageResp = await fetch(
    //     `https://ourworldindata.org/grapher/${currentSlug}`,
    //     { redirect: "manual" }
    // )

    const grapherPageResp = await env.ASSETS.fetch(url, { redirect: "manual" })

    if (grapherPageResp.status === 404) {
        // If the request is a 404, we check if there's a redirect for it.
        // If there is, we redirect to the new page.
        const redirectSlug = await getOptionalRedirectForSlug(slug, url, env)
        if (redirectSlug && redirectSlug !== slug) {
            return createRedirectResponse(redirectSlug, url)
        } else {
            // Otherwise we just return the 404 page.
            return grapherPageResp
        }
    }

    // A non-200 status code is most likely a redirect (301 or 302) or a 404, all of which we want to pass through as-is.
    // In the case of the redirect, the browser will then request the new URL which will again be handled by this worker.
    if (grapherPageResp.status !== 200) return grapherPageResp

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
    env: Env
) {
    console.log("Preapring json response for ", slug)
    // All our grapher slugs are lowercase by convention.
    // To allow incoming links that may contain uppercase characters to work, we redirect to the lowercase version.
    const lowerCaseSlug = slug.toLowerCase()
    if (lowerCaseSlug !== slug) {
        const redirectSlug = await getOptionalRedirectForSlug(
            lowerCaseSlug,
            env.url,
            env
        )

        return createRedirectResponse(
            redirectSlug ? `${redirectSlug}.config.json` : lowerCaseSlug,
            env.url
        )
    }

    const grapherPageResp = await fetchGrapherConfig({ slug, env })

    console.log("Grapher page response", grapherPageResp?.title)

    if (!grapherPageResp) {
        // If the request is a 404, we check if there's a redirect for it.
        // If there is, we redirect to the new page.
        const redirectSlug = await getOptionalRedirectForSlug(
            slug,
            env.url,
            env
        )
        if (redirectSlug && redirectSlug !== slug) {
            return createRedirectResponse(
                `${redirectSlug}.config.json`,
                env.url
            )
        } else {
            // Otherwise we just return the 404 page.
            return new Response(null, { status: 404 })
        }
    }

    return new Response(JSON.stringify(grapherPageResp), {
        headers: {
            "content-type": "application/json",
        },
    })
}
