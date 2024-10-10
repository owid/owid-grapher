import { Env } from "./env.js"
import { Etag, fetchAndRenderGrapher } from "./grapherRenderer.js"
import { GrapherIdentifier } from "./grapherTools.js"

export async function handleThumbnailRequest(
    id: GrapherIdentifier,
    searchParams: URLSearchParams,
    env: Env,
    _etag: Etag,
    ctx: EventContext<unknown, any, Record<string, unknown>>,
    extension: "png" | "svg"
) {
    const url = new URL(env.url)
    const shouldCache = !url.searchParams.has("nocache")

    const cache = caches.default
    console.log("Handling", env.url, ctx.request.headers.get("User-Agent"))
    if (shouldCache) {
        console.log("Checking cache")
        const maybeCached = await cache.match(ctx.request)
        console.log("Cache check result", maybeCached ? "hit" : "miss")
        if (maybeCached) return maybeCached
    }
    const resp = await fetchAndRenderGrapher(id, searchParams, extension, env)
    if (shouldCache) {
        resp.headers.set("Cache-Control", "s-maxage=3600, max-age=3600")
        ctx.waitUntil(caches.default.put(ctx.request, resp.clone()))
    } else resp.headers.set("Cache-Control", "no-cache")
    return resp
}
