import { Env, extensions } from "../../_common/env.js"
import { fetchGrapherConfig } from "../../_common/grapherTools.js"
import { IRequestStrict, Router, error, StatusError, cors } from "itty-router"
import { handleThumbnailRequest } from "../../_common/reusableHandlers.js"

const { preflight, corsify } = cors({
    allowMethods: ["GET", "OPTIONS", "HEAD"],
})

const router = Router<IRequestStrict, [URL, Env, string]>({
    before: [preflight],
    finally: [corsify],
})

router
    .get(
        `/grapher/by-uuid/:uuid${extensions.configJson}`,
        async ({ params: { uuid } }, { searchParams }, env, etag) =>
            handleConfigRequest(uuid, searchParams, env, etag)
    )
    .get(
        `/grapher/by-uuid/:uuid${extensions.png}`,
        async ({ params: { uuid } }, { searchParams }, env, etag, ctx) =>
            handleThumbnailRequest(
                { type: "uuid", id: uuid },
                searchParams,
                env,
                etag,
                ctx,
                "png"
            )
    )
    .get(
        `/grapher/by-uuid/:uuid${extensions.svg}`,
        async ({ params: { uuid } }, { searchParams }, env, etag, ctx) =>
            handleThumbnailRequest(
                { type: "uuid", id: uuid },
                searchParams,
                env,
                etag,
                ctx,
                "svg"
            )
    )
    .all("*", () => error(404, "Route not defined"))

export const onRequest: PagesFunction = async (context) => {
    const { request, env } = context
    const url = new URL(request.url)

    return router
        .fetch(
            request,
            url,
            { ...env, url },
            request.headers.get("if-none-match"),
            context
        )
        .catch((e) => {
            if (e instanceof StatusError) {
                return error(e.status, e.message)
            }

            return error(500, e)
        })
}

async function handleConfigRequest(
    uuid: string,
    searchParams: URLSearchParams,
    env: Env,
    etag: string | undefined
) {
    const shouldCache = searchParams.get("nocache") === null
    console.log("Preparing json response for uuid ", uuid)

    const grapherPageResp = await fetchGrapherConfig({
        identifier: { type: "uuid", id: uuid },
        env,
        etag,
    })

    if (grapherPageResp.status === 304) {
        return new Response(null, { status: 304 })
    }

    console.log("Grapher page response", grapherPageResp.grapherConfig.title)

    const cacheControl = shouldCache
        ? "s-maxage=300, max-age=0, must-revalidate"
        : "no-cache"

    return Response.json(grapherPageResp.grapherConfig, {
        headers: {
            "content-type": "application/json",
            "Cache-Control": cacheControl,
            ETag: grapherPageResp.etag,
        },
    })
}
