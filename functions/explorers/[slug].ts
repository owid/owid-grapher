import { Env, Etag, extensions } from "../_common/env.js"
import { extractOptions } from "../_common/imageOptions.js"
import { buildExplorerProps, Explorer } from "@ourworldindata/explorer"
import { handlePageNotFound } from "../_common/redirectTools.js"
import { renderSvgToPng } from "../_common/grapherRenderer.js"
import { IRequestStrict, Router, error, cors, png } from "itty-router"
import { Bounds, Url } from "@ourworldindata/utils"
import {
    getSelectedEntityNamesParam,
    migrateSelectedEntityNamesParam,
    SelectionArray,
} from "@ourworldindata/grapher"
import { rewriteMetaTags } from "../_common/grapherTools.js"

const { preflight, corsify } = cors({
    allowMethods: ["GET", "OPTIONS", "HEAD"],
})

const router = Router<
    IRequestStrict,
    [URL, Env, Etag, EventContext<unknown, any, Record<string, unknown>>]
>({
    before: [preflight],
    finally: [
        // This is a workaround for a bug in itty-router; without this, we would get 500 errors with
        // "Can't modify immutable headers." for requests served from cache.
        // see https://github.com/kwhitley/itty-router/issues/242#issuecomment-2194227007
        (resp: Response) => corsify(new Response(resp.body, resp)),
    ],
})
router
    .get(
        `/explorers/:slug${extensions.svg}`,
        async (_, { searchParams }, env) => {
            console.log("Handling explorer SVG thumbnail request")
            return handleThumbnailRequest(searchParams, env, "svg")
        }
    )
    .get(
        `/explorers/:slug${extensions.png}`,
        async (_, { searchParams }, env) => {
            console.log("Handling explorer PNG thumbnail request")
            return handleThumbnailRequest(searchParams, env, "png")
        }
    )
    .get(
        "/explorers/:slug",
        async ({ params: { slug } }, { searchParams }, env) => {
            console.log("Handling explorer HTML page request")
            return handleHtmlPageRequest(slug, searchParams, env)
        }
    )
    .all("*", () => error(404, "Route not defined"))

async function handleThumbnailRequest(
    searchParams: URLSearchParams,
    env: Env,
    extension: "png" | "svg"
) {
    const options = extractOptions(searchParams)
    const url = env.url
    url.href = url.href.replace(`.${extension}`, "")
    const explorerPage = await env.ASSETS.fetch(url, {
        redirect: "manual",
    })

    try {
        const html = await explorerPage.text()
        const queryStr = url.searchParams.toString()
        // The env URL class isn't compatible with the Url class from @ourworldindata/utils
        const urlObj = Url.fromURL(url.toString())
        const [windowEntityNames] = [urlObj]
            .map(migrateSelectedEntityNamesParam)
            .map(getSelectedEntityNamesParam)

        const selection = new SelectionArray(windowEntityNames)
        const bounds = new Bounds(0, 0, options.svgWidth, options.svgHeight)
        const explorerProps = await buildExplorerProps(
            html,
            queryStr,
            selection,
            bounds
        )
        const explorer = new Explorer(explorerProps)
        explorer.updateGrapherFromExplorer()
        while (!explorer.grapher.isReady) {
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
        explorer.grapher.populateFromQueryParams(urlObj.queryParams)
        const svg = explorer.grapher.generateStaticSvg()
        if (extension === "svg") {
            return new Response(svg, {
                headers: {
                    "Content-Type": "image/svg+xml",
                    "Cache-Control": "public, max-age=600",
                },
            })
        } else {
            return png(await renderSvgToPng(svg, options))
        }
    } catch (e) {
        console.error(e)
        return error(500, e)
    }
}

async function handleHtmlPageRequest(
    slug: string,
    _searchParams: URLSearchParams,
    env: Env
) {
    const url = env.url

    const explorerPage = await env.ASSETS.fetch(url, {
        redirect: "manual",
    })

    if (explorerPage.status === 404) {
        return handlePageNotFound(env, explorerPage)
    }

    const openGraphThumbnailUrl = `/explorers/${slug}.png?imType=og${
        url.search ? "&" + url.search.slice(1) : ""
    }`
    const twitterThumbnailUrl = `/explorers/${slug}.png?imType=twitter${
        url.search ? "&" + url.search.slice(1) : ""
    }`

    const explorerPageWithUpdatedMetaTags = rewriteMetaTags(
        url,
        openGraphThumbnailUrl,
        twitterThumbnailUrl,
        explorerPage
    )

    return explorerPageWithUpdatedMetaTags
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
