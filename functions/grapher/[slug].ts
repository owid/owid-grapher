export const onRequest: PagesFunction = async ({ request, params, env }) => {
    const slug = params.slug as string
    const { search } = new URL(request.url)
    const grapherPageHtml = await env.ASSETS.fetch(`/grapher/${slug}`).then(
        (res) => res.text()
    )

    const transformedHtml = grapherPageHtml.replace(
        /"[^"]+\/default-grapher-thumbnail.png"/g,
        `"https://thumbnails.owid.io/grapher/${slug}.png${search}"`
    )

    return new Response(transformedHtml)
}
