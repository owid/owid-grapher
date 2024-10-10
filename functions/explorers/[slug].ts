import { Env } from "../_common/env.js"
import { Etag, handlePageNotFound } from "../_common/grapherRenderer.js"
import { IRequestStrict, Router, StatusError, error, cors } from "itty-router"

const { preflight, corsify } = cors({
    allowMethods: ["GET", "OPTIONS", "HEAD"],
})

const router = Router<
    IRequestStrict,
    [URL, Env, Etag, EventContext<unknown, any, Record<string, unknown>>]
>({
    before: [preflight],
    finally: [corsify],
})
router
    .get(
        "/explorers/:slug",
        async ({ params: { slug } }, { searchParams }, env) => {
            console.log("handling slug")
            return handleHtmlPageRequest(slug, searchParams, env)
        }
    )
    .all("*", () => error(404, "Route not defined"))

async function handleHtmlPageRequest(
    slug: string,
    _searchParams: URLSearchParams,
    env: Env
) {
    const url = env.url

    // For local testing
    // const grapherPageResp = await fetch(
    //     `https://ourworldindata.org/grapher/${currentSlug}`,
    //     { redirect: "manual" }
    // )

    const explorerPage = await env.ASSETS.fetch(url, {
        redirect: "manual",
    })

    // read page body html
    const body = await explorerPage.text()
    console.log("body", body)

    if (explorerPage.status === 404) {
        return handlePageNotFound(env, explorerPage)
    }

    return explorerPage
}

export const onRequest: PagesFunction<Env> = async (context) => {
    context.passThroughOnException()
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
        .catch(async (e) => {
            console.log("Handling 404 for", url.pathname)
            return error(500, e)
        })
}
