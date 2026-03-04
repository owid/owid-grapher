import { cors, IRequestStrict, Router } from "itty-router"
import { Env } from "../_common/env.js"
import { fetchUnparsedGrapherConfig } from "../_common/grapherTools.js"

const { preflight, corsify } = cors({
    allowMethods: ["GET", "OPTIONS", "HEAD"],
})

const router = Router<IRequestStrict, [Env, Params]>({
    before: [preflight],
    finally: [corsify],
})

router.get("*", async (request, env, params) => {
    const slug = params.slug as string
    const etag = request.headers.get("if-none-match")
    const url = new URL(request.url)
    const shouldCache = url.searchParams.get("nocache") === null
    console.log("Preparing json response for ", slug)

    const grapherPageResp = await fetchUnparsedGrapherConfig(
        { type: "multi-dim-slug", id: slug },
        env,
        etag ?? undefined,
        shouldCache
    )

    if (grapherPageResp.status === 304) {
        console.log("Returning 304 for ", slug)
        return new Response(null, { status: 304 })
    }

    if (grapherPageResp.status === 404) {
        return new Response("Not found", { status: 404 })
    }

    if (grapherPageResp.status !== 200) {
        console.log(
            "Returning non-200 config response for multi-dim slug",
            slug,
            grapherPageResp.status
        )
        return new Response(grapherPageResp.body, {
            status: grapherPageResp.status,
            headers: {
                "Cache-Control": "no-cache",
                "Content-Type":
                    grapherPageResp.headers.get("Content-Type") ??
                    "application/json",
            },
        })
    }

    const cacheControl = shouldCache
        ? "s-maxage=300, max-age=0, must-revalidate"
        : "no-cache"

    return new Response(grapherPageResp.body, {
        status: grapherPageResp.status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": cacheControl,
            ETag: grapherPageResp.headers.get("ETag") ?? "",
        },
    })
})

export const onRequestGet: PagesFunction<Env> = async ({
    env,
    params,
    request,
}) => {
    return router.fetch(request, env, params)
}
