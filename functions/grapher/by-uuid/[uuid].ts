import { Env } from "../../_common/env.js"
import { fetchGrapherConfig } from "../../_common/grapherRenderer.js"
import { IRequestStrict, Router, error, StatusError } from "itty-router"

const router = Router<IRequestStrict, [URL, Env, string]>()
router
    .get(
        "/grapher/by-uuid/:uuid.config.json",
        async ({ params: { uuid } }, { searchParams }, env, etag) =>
            handleConfigRequest(uuid, searchParams, env, etag)
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
            request.headers.get("if-none-match")
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

    const grapherPageResp = await fetchGrapherConfig(
        { type: "uuid", id: uuid },
        env,
        etag
    )

    if (grapherPageResp.status === 304) {
        return new Response(null, { status: 304 })
    }

    console.log("Grapher page response", grapherPageResp.grapherConfig.title)

    const cacheControl = shouldCache
        ? "public, s-maxage=3600, max-age=0, must-revalidate"
        : "public, s-maxage=0, max-age=0, must-revalidate"

    return new Response(JSON.stringify(grapherPageResp.grapherConfig), {
        headers: {
            "content-type": "application/json",
            "Cache-Control": cacheControl,
            ETag: grapherPageResp.etag,
        },
    })
}
