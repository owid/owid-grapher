export const onRequestGet: PagesFunction = async ({ request, params, env }) => {
    const slug = params.slug as string
    const url = new URL(request.url)
    const { search } = url

    const grapherPageResp = await env.ASSETS.fetch(url, { redirect: "manual" })

    // For local testing
    // const grapherPageResp = await fetch(
    //     `https://ourworldindata.org/grapher/${slug}`,
    //     { redirect: "manual" }
    // )

    if (grapherPageResp.status !== 200) return grapherPageResp

    const thumbnailUrl = `https://thumbnails.owid.io/grapher/${slug}.png${search}`

    const rewriter = new HTMLRewriter().on("meta", {
        element: (element) => {
            if (
                element.getAttribute("property") === "og:image" ||
                element.getAttribute("name") === "twitter:image"
            )
                element.setAttribute("content", thumbnailUrl)
        },
    })

    return rewriter.transform(grapherPageResp)
}
