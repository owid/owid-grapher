import { fetchAndRenderGrapher } from "../../_common/grapherRenderer.js"
import { IRequestStrict, Router, error } from "itty-router"

export interface Env {
    ASSETS: {
        fetch: typeof fetch
    }
    r2ChartConfigs: {
        get: (url: string) => Promise<R2ObjectBody>
    }
    url: URL
    GRAPHER_CONFIG_R2_BUCKET_PATH: string
    CF_PAGES_BRANCH: string
}

const router = Router<IRequestStrict, [URL, Env, ExecutionContext]>()
router
    .get(
        "/grapher/thumbnail/:slug.png",
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchAndRenderGrapher(slug, searchParams, "png", env)
    )
    .get(
        "/grapher/thumbnail/:slug.svg",
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchAndRenderGrapher(slug, searchParams, "svg", env)
    )
    .get(
        "/grapher/thumbnail/:slug",
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchAndRenderGrapher(slug, searchParams, "svg", env)
    )
    .all("*", () => error(404, "Route not defined"))

export const onRequestGet: PagesFunction = async (ctx) => {
    const { request, env } = ctx

    const url = new URL(request.url)
    const shouldCache = !url.searchParams.has("nocache")

    const cache = caches.default
    if (shouldCache) {
        const maybeCached = await cache.match(request)
        if (maybeCached) return maybeCached
    }

    console.log("Handling", request.url, request.headers.get("User-Agent"))

    return router
        .fetch(request, url, { ...env, url }, ctx)
        .then((resp: Response) => {
            if (shouldCache) {
                resp.headers.set(
                    "Cache-Control",
                    "public, s-maxage=3600, max-age=3600"
                )
                ctx.waitUntil(caches.default.put(request, resp.clone()))
            } else
                resp.headers.set(
                    "Cache-Control",
                    "public, s-maxage=0, max-age=0, must-revalidate"
                )
            return resp
        })
        .catch((e) => error(500, e))
}
