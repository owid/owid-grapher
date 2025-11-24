import { Env, Etag } from "./env.js"
import { fetchAndRenderGrapher } from "./grapherRenderer.js"
import { GrapherIdentifier } from "./grapherTools.js"

export async function checkCache(
    request: Request,
    shouldCache: boolean
): Promise<Response | null> {
    if (!shouldCache) return null

    console.log("Checking cache")
    const cache = (caches as any).default
    const maybeCached = await cache.match(request)

    console.log("Cache check result", maybeCached ? "hit" : "miss")

    if (maybeCached) {
        // Cached responses are immutable, so we have to clone them,
        // so that the corsify middleware can add CORS headers
        return new Response(maybeCached.body, maybeCached)
    }

    return null
}

export async function handleThumbnailRequest(
    id: GrapherIdentifier,
    searchParams: URLSearchParams,
    env: Env,
    _etag: Etag,
    ctx: EventContext<unknown, any, Record<string, unknown>>,
    extension: "png" | "svg"
) {
    const url = new URL(env.url)

    console.log("Handling", env.url, ctx.request.headers.get("User-Agent"))

    // Check cache
    const shouldCache = !url.searchParams.has("nocache")
    const cachedResponse = await checkCache(ctx.request, shouldCache)
    if (cachedResponse) return cachedResponse

    const resp = await fetchAndRenderGrapher(id, searchParams, extension, env)
    if (shouldCache) {
        resp.headers.set("Cache-Control", "max-age=3600")
        ctx.waitUntil((caches as any).default.put(ctx.request, resp.clone()))
    } else resp.headers.set("Cache-Control", "no-cache")
    return resp
}
