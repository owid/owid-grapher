import { Grapher } from "@ourworldindata/grapher"
import {
    GrapherInterface,
    R2GrapherConfigDirectory,
} from "@ourworldindata/types"
import { excludeUndefined, Bounds } from "@ourworldindata/utils"
import { StatusError } from "itty-router"
import { Env } from "./env.js"
import { fetchFromR2, grapherBaseUrl } from "./grapherRenderer.js"
import { ImageOptions } from "./imageOptions.js"

interface FetchGrapherConfigResult {
    grapherConfig: GrapherInterface | null
    status: number
    etag: string | undefined
}

export interface GrapherSlug {
    type: "slug"
    id: string
}

export interface GrapherUuid {
    type: "uuid"
    id: string
}

export type GrapherIdentifier = GrapherSlug | GrapherUuid

export async function fetchUnparsedGrapherConfig(
    identifier: GrapherIdentifier,
    env: Env,
    etag?: string
) {
    // The top level directory is either the bucket path (should be set in dev environments and production)
    // or the branch name on preview staging environments
    console.log("branch", env.CF_PAGES_BRANCH)
    const topLevelDirectory = env.GRAPHER_CONFIG_R2_BUCKET_PATH
        ? [env.GRAPHER_CONFIG_R2_BUCKET_PATH]
        : ["by-branch", env.CF_PAGES_BRANCH]

    const directory =
        identifier.type === "slug"
            ? R2GrapherConfigDirectory.publishedGrapherBySlug
            : R2GrapherConfigDirectory.byUUID

    const key = excludeUndefined([
        ...topLevelDirectory,
        directory,
        `${identifier.id}.json`,
    ]).join("/")

    console.log("fetching grapher config from this key", key)

    const requestUrl = new URL(key, env.GRAPHER_CONFIG_R2_BUCKET_URL)

    let fallbackUrl

    if (
        env.GRAPHER_CONFIG_R2_BUCKET_FALLBACK_URL &&
        env.GRAPHER_CONFIG_R2_BUCKET_FALLBACK_PATH
    ) {
        const topLevelDirectory = env.GRAPHER_CONFIG_R2_BUCKET_FALLBACK_PATH
        const fallbackKey = excludeUndefined([
            topLevelDirectory,
            directory,
            `${identifier.id}.json`,
        ]).join("/")
        fallbackUrl = new URL(
            fallbackKey,
            env.GRAPHER_CONFIG_R2_BUCKET_FALLBACK_URL
        )
    }

    // Fetch grapher config
    return fetchFromR2(requestUrl, etag, fallbackUrl)
}

export async function fetchGrapherConfig(
    identifier: GrapherIdentifier,
    env: Env,
    etag?: string
): Promise<FetchGrapherConfigResult> {
    const fetchResponse = await fetchUnparsedGrapherConfig(
        identifier,
        env,
        etag
    )

    if (fetchResponse.status === 404) {
        // we throw 404 errors instead of returning a 404 response so that the router
        // catch handler can do a lookup in the redirects file and maybe send
        // a 302 redirect response
        throw new StatusError(404)
    }

    if (fetchResponse.status !== 200) {
        console.log(
            "Status code is not 200, returning empty response with status code",
            fetchResponse.status
        )
        return {
            grapherConfig: null,
            status: fetchResponse.status,
            etag: fetchResponse.headers.get("etag"),
        }
    }

    const grapherConfig: GrapherInterface = await fetchResponse.json()
    console.log("grapher title", grapherConfig.title)
    return {
        grapherConfig,
        status: 200,
        etag: fetchResponse.headers.get("etag"),
    }
}
export async function initGrapher(
    identifier: GrapherIdentifier,
    options: ImageOptions,
    searchParams: URLSearchParams,
    env: Env
): Promise<Grapher> {
    const grapherConfigResponse = await fetchGrapherConfig(identifier, env)

    if (grapherConfigResponse.status === 404) {
        // we throw 404 errors instad of returning a 404 response so that the router
        // catch handler can do a lookup in the redirects file and maybe send
        // a 302 redirect response
        throw new StatusError(grapherConfigResponse.status)
    }

    const bounds = new Bounds(0, 0, options.svgWidth, options.svgHeight)
    const grapher = new Grapher({
        ...grapherConfigResponse.grapherConfig,
        bakedGrapherURL: grapherBaseUrl,
        queryStr: "?" + searchParams.toString(),
        bounds,
        staticBounds: bounds,
        baseFontSize: options.fontSize,
    })
    grapher.shouldIncludeDetailsInStaticExport = options.details

    return grapher
}

/**
 * Update og:url, og:image, and twitter:image meta tags to include the search parameters.
 */
export function rewriteMetaTags(
    url: URL,
    openGraphThumbnailUrl: string,
    twitterThumbnailUrl: string,
    page: Response
) {
    // Take the origin (e.g. https://ourworldindata.org) from the canonical URL, which should appear before the image elements.
    // If we fail to capture the origin, we end up with relative image URLs, which should also be okay.
    let origin = ""

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

    return rewriter.transform(page)
}
