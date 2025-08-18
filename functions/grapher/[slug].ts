import { Env, extensions, Etag } from "../_common/env.js"
import {
    fetchCsvForGrapher,
    fetchMetadataForGrapher,
    fetchReadmeForGrapher,
    fetchZipForGrapher,
} from "../_common/downloadFunctions.js"
import { handleThumbnailRequest } from "../_common/reusableHandlers.js"
import {
    handlePageNotFound,
    getRedirectForUrl,
} from "../_common/redirectTools.js"
import {
    fetchUnparsedGrapherConfig,
    rewriteMetaTags,
    addClassNamesToBody,
} from "../_common/grapherTools.js"
import { IRequestStrict, Router, StatusError, error, cors } from "itty-router"
import {
    EXPERIMENT_ARM_SEPARATOR,
    EXPERIMENT_PREFIX,
} from "@ourworldindata/types"
import { ServerCookie } from "../experiments/types.js"
import * as cookie from "cookie"

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
        `/grapher/:slug${extensions.configJson}`,
        async ({ params: { slug } }, { searchParams }, env, etag) =>
            handleConfigRequest(slug, searchParams, env, etag)
    )
    .get(
        `/grapher/:slug${extensions.png}`,
        async ({ params: { slug } }, { searchParams }, env, etag, ctx) =>
            handleThumbnailRequest(
                { type: "slug", id: slug },
                searchParams,
                env,
                etag,
                ctx,
                "png"
            )
    )
    .get(
        `/grapher/:slug${extensions.svg}`,
        async ({ params: { slug } }, { searchParams }, env, etag, ctx) =>
            handleThumbnailRequest(
                { type: "slug", id: slug },
                searchParams,
                env,
                etag,
                ctx,
                "svg"
            )
    )
    .get(
        `/grapher/:slug${extensions.csv}`,
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchCsvForGrapher({ type: "slug", id: slug }, env, searchParams)
    )
    .get(
        `/grapher/:slug${extensions.metadata}`,
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchMetadataForGrapher(
                { type: "slug", id: slug },
                env,
                searchParams
            )
    )
    .get(
        `/grapher/:slug${extensions.readme}`,
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchReadmeForGrapher({ type: "slug", id: slug }, env, searchParams)
    )
    .get(
        `/grapher/:slug${extensions.zip}`,
        async ({ params: { slug } }, { searchParams }, env) =>
            fetchZipForGrapher({ type: "slug", id: slug }, env, searchParams)
    )
    .get(
        "/grapher/:slug",
        async ({ params: { slug } }, { searchParams }, env, etag, ctx) =>
            handleHtmlPageRequest(slug, searchParams, env, ctx)
    )
    .all("*", () => error(404, "Route not defined"))

export const onRequest: PagesFunction<Env> = async (context) => {
    // Makes it so that if there's an error, we will just deliver the original page before the HTML rewrite.
    // Only caveat is that redirects will not be taken into account for some reason; but on the other hand the worker is so simple that it's unlikely to fail.
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
            // Here we do a unified after the fact handling of 404s to check
            // if we have a redirect in the _grapherRedirects.json file.
            // This is done as a catch handler that checks for 404 pages
            // so that the common, happy path does not have to fetch the redirects file.
            console.log("Handling error", e)
            if (e instanceof StatusError && e.status === 404) {
                console.log("Handling 404 for", url.pathname)
                const redirect = await getRedirectForUrl(env, url)
                return redirect || error(404, "Not found")
            } else if (e instanceof StatusError) {
                return error(e.status, e.message)
            } else return error(500, e)
        })
}

async function handleHtmlPageRequest(
    slug: string,
    _searchParams: URLSearchParams,
    env: Env,
    ctx: EventContext<unknown, any, Record<string, unknown>>
) {
    const url = env.url

    // For local testing
    // const grapherPageResp = await fetch(
    //     `https://ourworldindata.org/grapher/${currentSlug}`,
    //     { redirect: "manual" }
    // )

    const grapherPageResp = await env.ASSETS.fetch(env.url, {
        redirect: "manual",
    })

    if (grapherPageResp.status === 404) {
        // grapherPageResp should be a static 404 HTML page.
        return handlePageNotFound(env, grapherPageResp)
    }

    const cookies = cookie.parse(ctx.request.headers.get("cookie") || "")
    const cookiesToSet: ServerCookie[] =
        (ctx.data.cookiesToSet as ServerCookie[]) || []
    const combinedCookies = {
        ...cookies,
        ...Object.fromEntries(cookiesToSet.map((c) => [c.name, c.value])),
    }
    const experimentClassNames = Array.from(
        new Set(
            Object.entries(combinedCookies)
                .filter(([key]) => key.startsWith(`${EXPERIMENT_PREFIX}-`))
                .map(
                    ([key, value]) =>
                        `${key}${EXPERIMENT_ARM_SEPARATOR}${value}`
                )
        )
    )

    // A non-200 status code is most likely a redirect (301 or 302), all of which we want to pass through as-is.
    // In the case of the redirect, the browser will then request the new URL which will again be handled by this worker.
    if (grapherPageResp.status !== 200) return grapherPageResp

    const openGraphThumbnailUrl = `/grapher/${slug}.png?imType=og${
        url.search ? "&" + url.search.slice(1) : ""
    }`
    const twitterThumbnailUrl = `/grapher/${slug}.png?imType=twitter${
        url.search ? "&" + url.search.slice(1) : ""
    }`

    let grapherPageWithExperimentClasses = grapherPageResp
    if (experimentClassNames) {
        grapherPageWithExperimentClasses = addClassNamesToBody(
            grapherPageResp,
            experimentClassNames
        )
    }
    const grapherPageWithUpdatedMetaTags = rewriteMetaTags(
        url,
        openGraphThumbnailUrl,
        twitterThumbnailUrl,
        grapherPageWithExperimentClasses
    )

    if (cookiesToSet && cookiesToSet.length) {
        const headers = new Headers(grapherPageWithUpdatedMetaTags.headers)
        for (const serverCookie of cookiesToSet) {
            const cookieString = cookie.serialize(
                serverCookie.name,
                serverCookie.value,
                serverCookie.options
            )
            headers.append("Set-Cookie", cookieString)
        }
        return new Response(grapherPageWithUpdatedMetaTags.body, {
            status: grapherPageWithUpdatedMetaTags.status,
            statusText: grapherPageWithUpdatedMetaTags.statusText,
            headers,
        })
    }

    return grapherPageWithUpdatedMetaTags
}

async function handleConfigRequest(
    slug: string,
    searchParams: URLSearchParams,
    env: Env,
    etag: string | undefined
) {
    const shouldCache = searchParams.get("nocache") === null
    console.log("Preparing json response for ", slug)

    const grapherPageResp = await fetchUnparsedGrapherConfig(
        { type: "slug", id: slug },
        env,
        etag
    )

    if (grapherPageResp.status === 304) {
        console.log("Returning 304 for ", slug)
        return new Response(null, { status: 304 })
    }

    if (grapherPageResp.status === 404) {
        throw new StatusError(404)
    }

    const cacheControl = shouldCache
        ? "s-maxage=300, max-age=0, must-revalidate"
        : "no-cache"

    //grapherPageResp.headers.set("Cache-Control", cacheControl)
    return new Response(grapherPageResp.body as any, {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": cacheControl,
            ETag: grapherPageResp.headers.get("ETag") ?? "",
        },
    })
}
