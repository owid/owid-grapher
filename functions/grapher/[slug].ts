export const onRequestGet: PagesFunction = async ({ request, params, env }) => {
    const slug = params.slug as string
    const url = new URL(request.url)
    const { search } = url
    const grapherPageResp = await env.ASSETS.fetch(url)
    const grapherPageHtml = await grapherPageResp.text()

    const transformedHtml = grapherPageHtml.replace(
        /"[^"]+\/default-grapher-thumbnail.png"/g,
        `"https://thumbnails.owid.io/grapher/${slug}.png${search}"`
    )

    return new Response(transformedHtml, grapherPageResp)
}
