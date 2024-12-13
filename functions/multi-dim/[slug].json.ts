import { Env } from "../_common/env.js"
import { fetchUnparsedGrapherConfig } from "../_common/grapherTools.js"

export const onRequestGet: PagesFunction<Env> = async ({
    env,
    params,
    request,
}) => {
    const slug = params.slug as string
    const etag = request.headers.get("if-none-match")
    const url = new URL(request.url)
    const shouldCache = url.searchParams.get("nocache") === null
    console.log("Preparing json response for ", slug)

    const grapherPageResp = await fetchUnparsedGrapherConfig(
        { type: "multi-dim-slug", id: slug },
        env,
        etag
    )

    if (grapherPageResp.status === 304) {
        console.log("Returning 304 for ", slug)
        return new Response(null, { status: 304 })
    }

    if (grapherPageResp.status === 404) {
        return new Response("Not found", { status: 404 })
    }

    const cacheControl = shouldCache
        ? "s-maxage=300, max-age=0, must-revalidate"
        : "no-cache"

    return new Response(grapherPageResp.body, {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": cacheControl,
            ETag: grapherPageResp.headers.get("ETag") ?? "",
        },
    })
}
