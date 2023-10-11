export const onRequestGet: PagesFunction = async (context) => {
    // Makes it so that if there's an error, we will just deliver the original page before the HTML rewrite.
    // Only caveat is that redirects will not be taken into account for some reason; but on the other hand the worker is so simple that it's unlikely to fail.
    context.passThroughOnException()

    const { request, env, params } = context

    const slug = params.slug as string
    const url = new URL(request.url)

    // Redirect to lowercase slug
    if (url.pathname !== url.pathname.toLowerCase()) {
        return Response.redirect(url.pathname.toLowerCase() + url.search, 301)
    }

    const { search } = url

    const grapherPageResp = await env.ASSETS.fetch(url, { redirect: "manual" })

    // For local testing
    // const grapherPageResp = await fetch(
    //     `https://ourworldindata.org/grapher/${slug}`,
    //     { redirect: "manual" }
    // )

    // A non-200 status code is most likely a redirect (301 or 302) or a 404, all of which we want to pass through as-is.
    // In the case of the redirect, the browser will then request the new URL which will again be handled by this worker.
    if (grapherPageResp.status !== 200) return grapherPageResp

    const openGraphThumbnailUrl = `/grapher/thumbnail/${slug}.png?imType=og${
        search ? "&" + search.slice(1) : ""
    }`
    const twitterThumbnailUrl = `/grapher/thumbnail/${slug}.png?imType=twitter${
        search ? "&" + search.slice(1) : ""
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
                element.setAttribute("content", canonicalUrl + search)
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

    return rewriter.transform(grapherPageResp)
}
