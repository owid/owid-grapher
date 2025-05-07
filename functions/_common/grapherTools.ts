import {
    generateGrapherImageSrcSet,
    Grapher,
    GrapherState,
} from "@ourworldindata/grapher"
import {
    GrapherInterface,
    MultiDimDataPageConfigEnriched,
    R2GrapherConfigDirectory,
} from "@ourworldindata/types"
import {
    excludeUndefined,
    Bounds,
    searchParamsToMultiDimView,
} from "@ourworldindata/utils"
import { StatusError } from "itty-router"
import { Env } from "./env.js"
import { fetchFromR2, grapherBaseUrl } from "./grapherRenderer.js"
import { ImageOptions } from "./imageOptions.js"

interface FetchGrapherConfigResult {
    grapherConfig: GrapherInterface | null
    multiDimAvailableDimensions?: string[]
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

export interface MultiDimSlug {
    type: "multi-dim-slug"
    id: string
}

export type GrapherIdentifier = GrapherSlug | GrapherUuid | MultiDimSlug

const directoryMap = {
    uuid: R2GrapherConfigDirectory.byUUID,
    slug: R2GrapherConfigDirectory.publishedGrapherBySlug,
    "multi-dim-slug": R2GrapherConfigDirectory.multiDim,
}

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
    const directory = directoryMap[identifier.type]

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

async function fetchMultiDimGrapherConfig(
    multiDimConfig: MultiDimDataPageConfigEnriched,
    searchParams: URLSearchParams,
    env: Env
) {
    const view = searchParamsToMultiDimView(multiDimConfig, searchParams)
    const response = await fetchUnparsedGrapherConfig(
        { type: "uuid", id: view.fullConfigId },
        env
    )
    return await response.json()
}

export async function fetchGrapherConfig({
    identifier,
    env,
    etag,
    searchParams,
}: {
    identifier: GrapherIdentifier
    env: Env
    etag?: string
    searchParams?: URLSearchParams
}): Promise<FetchGrapherConfigResult> {
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

    const config = await fetchResponse.json()
    let grapherConfig: GrapherInterface
    let multiDimAvailableDimensions: string[]
    if (identifier.type === "multi-dim-slug") {
        const multiDimConfig = config as MultiDimDataPageConfigEnriched
        grapherConfig = await fetchMultiDimGrapherConfig(
            multiDimConfig,
            searchParams,
            env
        )
        multiDimAvailableDimensions = multiDimConfig.dimensions.map(
            (dim) => dim.slug
        )
    } else {
        grapherConfig = config
    }
    console.log("grapher title", grapherConfig.title)
    const result: FetchGrapherConfigResult = {
        grapherConfig,
        status: 200,
        etag: fetchResponse.headers.get("etag"),
    }
    if (identifier.type === "multi-dim-slug") {
        result.multiDimAvailableDimensions = multiDimAvailableDimensions
    }
    return result
}

export async function initGrapher(
    identifier: GrapherIdentifier,
    options: ImageOptions,
    searchParams: URLSearchParams,
    env: Env
): Promise<{
    grapher: Grapher
    multiDimAvailableDimensions?: string[]
}> {
    let grapherConfigResponse: FetchGrapherConfigResult
    try {
        grapherConfigResponse = await fetchGrapherConfig({
            identifier,
            env,
            searchParams,
        })
    } catch (e) {
        if (
            identifier.type === "slug" &&
            e instanceof StatusError &&
            e.status === 404
        ) {
            // Normal graphers and multi-dims have the same URL namespace, but
            // we have no way of knowing which of them was requested, so we try
            // again with a multi-dim identifier.
            const multiDimId: MultiDimSlug = {
                type: "multi-dim-slug",
                id: identifier.id,
            }
            grapherConfigResponse = await fetchGrapherConfig({
                identifier: multiDimId,
                env,
                searchParams,
            })
        } else {
            throw e
        }
    }

    if (grapherConfigResponse.status === 404) {
        // we throw 404 errors instad of returning a 404 response so that the router
        // catch handler can do a lookup in the redirects file and maybe send
        // a 302 redirect response
        throw new StatusError(grapherConfigResponse.status)
    }

    const bounds = new Bounds(0, 0, options.svgWidth, options.svgHeight)
    const grapherState = new GrapherState({
        ...grapherConfigResponse.grapherConfig,
        bakedGrapherURL: grapherBaseUrl,
        queryStr: "?" + searchParams.toString(),
        bounds,
        staticBounds: bounds,
        baseFontSize: options.fontSize,
        ...options.grapherProps,
    })
    grapherState.isExportingToSvgOrPng = true
    grapherState.shouldIncludeDetailsInStaticExport = options.details
    const grapher = new Grapher({ grapherState })

    return {
        grapher,
        multiDimAvailableDimensions:
            grapherConfigResponse.multiDimAvailableDimensions,
    }
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

    const thumbnailUrl = `${url.pathname}.png${url.search}`

    const rewriter = new HTMLRewriter()
        .on("picture[data-owid-populate-url-params] source", {
            element: (source) => {
                if (thumbnailUrl) {
                    const srcSet = generateGrapherImageSrcSet(thumbnailUrl)
                    source.setAttribute("srcset", srcSet)
                }
            },
        })
        .on("picture[data-owid-populate-url-params] img", {
            element: (img) => {
                if (thumbnailUrl) {
                    img.setAttribute("src", thumbnailUrl)
                }
            },
        })
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
