import { Env } from "../../_common/env.js"
import { fetchAndRenderGrapher } from "../../_common/grapherRenderer.js"
import { IRequestStrict, Router, error } from "itty-router"
import { checkCache } from "../../_common/reusableHandlers.js"

// TODO: remove the /grapher/thumbnail route two weeks or so after the change to use /grapher/:slug.png is deployed
// We keep this around for another two weeks so that cached html pages etc can still fetch the correct thumbnail
const router = Router<IRequestStrict, [URL, Env, ExecutionContext]>()
router
    .get(
        "/grapher/thumbnail/:slug.png",
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchAndRenderGrapher(
                { type: "slug", id: slug },
                searchParams,
                "png",
                env
            )
    )
    .get(
        "/grapher/thumbnail/:slug.svg",
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchAndRenderGrapher(
                { type: "slug", id: slug },
                searchParams,
                "svg",
                env
            )
    )
    .get(
        "/grapher/thumbnail/:slug",
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchAndRenderGrapher(
                { type: "slug", id: slug },
                searchParams,
                "svg",
                env
            )
    )
    .all("*", () => error(404, "Route not defined"))

export const onRequestGet: PagesFunction = async (ctx) => {
    const { request, env } = ctx

    const url = new URL(request.url)

    // Check cache
    const shouldCache = !url.searchParams.has("nocache")
    const cachedResponse = await checkCache(ctx.request, shouldCache)
    if (cachedResponse) return cachedResponse

    console.log("Handling", request.url, request.headers.get("User-Agent"))

    return router
        .fetch(request, url, { ...env, url }, ctx)
        .then((resp: Response) => {
            if (shouldCache) {
                resp.headers.set("Cache-Control", "max-age=3600")
                ctx.waitUntil(caches.default.put(request, resp.clone()))
            } else resp.headers.set("Cache-Control", "no-cache")
            return resp
        })
        .catch((e) => error(500, e))
}
