import { Env } from "../_common/env.js"
import { buildExplorerProps, Explorer } from "@ourworldindata/explorer"
import {
    Etag,
    extensions,
    extractOptions,
    handlePageNotFound,
    renderSvgToPng,
} from "../_common/grapherRenderer.js"
import { IRequestStrict, Router, error, cors, png } from "itty-router"
import { Url } from "@ourworldindata/utils"
import {
    getSelectedEntityNamesParam,
    migrateSelectedEntityNamesParam,
    SelectionArray,
} from "@ourworldindata/grapher"

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
    console.log("handleThumbnailRequest")
    const url = env.url
    url.href = url.href.replace(`.${extension}`, "")
    const explorerPage = await env.ASSETS.fetch(url, {
        redirect: "manual",
    })

    try {
        const html = await explorerPage.text()
        const queryStr = url.searchParams.toString()
        const urlObj = Url.fromURL(url.toString())
        const [windowEntityNames] = [urlObj]
            .map(migrateSelectedEntityNamesParam)
            .map(getSelectedEntityNamesParam)

        const selection = new SelectionArray(windowEntityNames)
        const explorerProps = await buildExplorerProps(
            html,
            queryStr,
            selection
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
            const options = extractOptions(searchParams)
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

    // Take the origin (e.g. https://ourworldindata.org) from the canonical URL, which should appear before the image elements.
    // If we fail to capture the origin, we end up with relative image URLs, which should also be okay.
    let origin = ""

    // Rewrite the two meta tags that are used for a social media preview image.
    const rewriter = new HTMLRewriter()
        .on('meta[property="og:url"]', {
            // Replace canonical URL, otherwise the preview image will not include the search parameters.
            element: (element) => {
                const canonicalUrl = element.getAttribute("content")
                element.setAttribute("content", canonicalUrl + url.search)
                try {
                    origin = new URL(canonicalUrl).origin
                } catch (e) {
                    console.error("Error parsing canonical URL", e)
                }
            },
        })
        .on('meta[property="og:image"]', {
            element: (element) => {
                element.setAttribute("content", origin + openGraphThumbnailUrl)
            },
        })
        .on('meta[name="twitter:image"]', {
            element: (element) => {
                element.setAttribute("content", origin + twitterThumbnailUrl)
            },
        })

    return rewriter.transform(explorerPage as unknown as Response)
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
