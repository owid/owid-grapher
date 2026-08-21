import * as _ from "lodash-es"
import { runInAction } from "mobx"
import {
    CsvDownloadType,
    type DataDownloadContextBase,
    generateGrapherImageSrcSet,
    getDownloadUrl,
    Grapher,
    GrapherState,
    loadCatalogData,
} from "@ourworldindata/grapher"
import {
    type DownloadRewriteTarget,
    GrapherInterface,
    MultiDimDataPageConfigEnriched,
    MultiDimPageCompanion,
    R2GrapherConfigDirectory,
    AdditionalGrapherDataFetchFn,
    GRAPHER_QUERY_PARAM_KEYS,
} from "@ourworldindata/types"
import {
    excludeUndefined,
    Bounds,
    makeDownloadCodeExamples,
    multiDimDimensionsToViewQueryStr,
    searchParamsToMultiDimView,
    escapeJSONStringForInlineScript,
} from "@ourworldindata/utils"
import * as Sentry from "@sentry/cloudflare"
import { StatusError } from "itty-router"
import { Env } from "./env.js"
import { ImageOptions } from "./imageOptions.js"

export const grapherBaseUrl = "https://ourworldindata.org/grapher"

interface FetchGrapherConfigResult {
    grapherConfig: GrapherInterface | null
    multiDimAvailableDimensions?: string[]
    status: number
    etag: string | undefined
}

interface FetchMultiDimGrapherConfigResult {
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

export interface MultiDimSlug {
    type: "multi-dim-slug"
    id: string
}

export type GrapherIdentifier = GrapherSlug | GrapherUuid | MultiDimSlug

const directoryMap = {
    uuid: R2GrapherConfigDirectory.byUuid,
    slug: R2GrapherConfigDirectory.publishedGrapherBySlug,
    "multi-dim-slug": R2GrapherConfigDirectory.multiDim,
}

// write a function that constructs the DATA_API_URL based on
// whether the complete or partial ones are given (later needs branch)
export function getDataApiUrl(env: Env) {
    if (env.DATA_API_URL_COMPLETE) return env.DATA_API_URL_COMPLETE
    else if (env.DATA_API_URL_PARTIAL_PREFIX)
        return `${env.DATA_API_URL_PARTIAL_PREFIX}${env.CF_PAGES_BRANCH}${env.DATA_API_URL_PARTIAL_POSTFIX}`
    throw new Error(
        "Neither DATA_API_URL_COMPLETE nor DATA_API_URL_PARTIAL_PREFIX and DATA_API_URL_PARTIAL_POSTFIX were declared!"
    )
}

function buildResponseFromR2Object(
    r2Object: R2ObjectBody | R2Object
): Response {
    const headers = new Headers()
    r2Object.writeHttpMetadata(headers)
    headers.set("ETag", r2Object.httpEtag)

    if ("body" in r2Object) {
        return new Response(r2Object.body, { status: 200, headers })
    }

    return new Response(null, { status: 304, headers })
}

export async function fetchFromR2(
    bucket: R2Bucket,
    key: string,
    etag: string | undefined
) {
    const object = etag
        ? await bucket.get(key, {
              onlyIf: new Headers({ "If-None-Match": etag }),
          })
        : await bucket.get(key)

    if (!object) {
        return new Response(null, { status: 404 })
    }

    return buildResponseFromR2Object(object)
}

export async function fetchUnparsedGrapherConfig(
    identifier: GrapherIdentifier,
    env: Env,
    etag?: string
) {
    if (!env.GRAPHER_CONFIG_R2_BUCKET) {
        throw new Error("Missing GRAPHER_CONFIG_R2_BUCKET binding")
    }

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

    const primaryResponse = await fetchFromR2(
        env.GRAPHER_CONFIG_R2_BUCKET,
        key,
        etag
    )
    if (primaryResponse.status !== 404) {
        return primaryResponse
    }

    // On staging and local development we can optionally fallback to the production bucket
    // if the config was not found in the branch bucket.
    if (!env.GRAPHER_CONFIG_R2_BUCKET_FALLBACK_PATH) {
        return primaryResponse
    }
    if (!env.GRAPHER_CONFIG_R2_BUCKET_FALLBACK) {
        throw new Error(
            "GRAPHER_CONFIG_R2_BUCKET_FALLBACK_PATH is set but GRAPHER_CONFIG_R2_BUCKET_FALLBACK binding is missing"
        )
    }

    const fallbackKey = excludeUndefined([
        env.GRAPHER_CONFIG_R2_BUCKET_FALLBACK_PATH,
        directory,
        `${identifier.id}.json`,
    ]).join("/")
    console.log("fetching grapher config from fallback key", fallbackKey)

    return fetchFromR2(env.GRAPHER_CONFIG_R2_BUCKET_FALLBACK, fallbackKey, etag)
}

async function fetchMultiDimGrapherConfig(
    multiDimConfig: MultiDimDataPageConfigEnriched,
    searchParams: URLSearchParams,
    env: Env
): Promise<FetchMultiDimGrapherConfigResult> {
    const view = searchParamsToMultiDimView(multiDimConfig, searchParams)
    const response = await fetchUnparsedGrapherConfig(
        { type: "uuid", id: view.fullConfigId },
        env,
        undefined
    )
    if (response.status !== 200) {
        return {
            grapherConfig: null,
            status: response.status,
            etag: response.headers.get("etag") ?? undefined,
        }
    }
    return {
        grapherConfig: await response.json(),
        status: response.status,
        etag: response.headers.get("etag") ?? undefined,
    }
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
        // a 301 redirect response
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
            etag: fetchResponse.headers.get("etag") ?? undefined,
        }
    }

    const config: unknown = await fetchResponse.json()
    let grapherConfig: GrapherInterface
    let multiDimAvailableDimensions: string[] | undefined
    let responseEtag = fetchResponse.headers.get("etag") ?? undefined
    if (identifier.type === "multi-dim-slug") {
        const multiDimConfig = config as MultiDimDataPageConfigEnriched
        const multiDimGrapherConfigResult = await fetchMultiDimGrapherConfig(
            multiDimConfig,
            searchParams ?? new URLSearchParams(),
            env
        )
        if (multiDimGrapherConfigResult.status !== 200) {
            return {
                grapherConfig: null,
                status: multiDimGrapherConfigResult.status,
                etag: multiDimGrapherConfigResult.etag ?? responseEtag,
            }
        }
        if (!multiDimGrapherConfigResult.grapherConfig) {
            return {
                grapherConfig: null,
                status: 500,
                etag: multiDimGrapherConfigResult.etag ?? responseEtag,
            }
        }
        grapherConfig = multiDimGrapherConfigResult.grapherConfig
        responseEtag = multiDimGrapherConfigResult.etag ?? responseEtag
        multiDimAvailableDimensions = multiDimConfig.dimensions.map(
            (dim) => dim.slug
        )
    } else {
        grapherConfig = config as GrapherInterface
    }
    console.log("grapher title", grapherConfig.title)
    const result: FetchGrapherConfigResult = {
        grapherConfig,
        status: 200,
        etag: responseEtag,
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
    identifierType: GrapherIdentifier["type"]
}> {
    let effectiveType = identifier.type

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
            effectiveType = "multi-dim-slug"
        } else {
            throw e
        }
    }

    if (grapherConfigResponse.status === 404) {
        // we throw 404 errors instad of returning a 404 response so that the router
        // catch handler can do a lookup in the redirects file and maybe send
        // a 301 redirect response
        throw new StatusError(grapherConfigResponse.status)
    }

    const additionalDataLoaderFn: AdditionalGrapherDataFetchFn = (catalogKey) =>
        loadCatalogData(catalogKey, {
            baseUrl: env.CATALOG_URL,
        })

    const bounds = new Bounds(0, 0, options.svgWidth, options.svgHeight)
    const grapherState = new GrapherState({
        ...grapherConfigResponse.grapherConfig,
        bakedGrapherURL: grapherBaseUrl,
        queryStr: "?" + searchParams.toString(),
        bounds,
        staticBounds: bounds,
        baseFontSize: options.fontSize,
        manager: {
            ...options.grapherProps?.manager,
            // Set the baseUrl to ensure mdims have correct canonical URL in the metadata json
            baseUrl: `${grapherBaseUrl}/${identifier.id}`,
        },
        additionalDataLoaderFn,
        ...options.grapherProps,
    })
    runInAction(() => {
        grapherState.isExportingToSvgOrPng = true
        grapherState.shouldIncludeDetailsInStaticExport = options.details
    })
    const grapher = new Grapher({ grapherState })

    return {
        grapher,
        identifierType: effectiveType,
        multiDimAvailableDimensions:
            grapherConfigResponse.multiDimAvailableDimensions,
    }
}

/**
 * HTMLRewriter doesn't un-encode HTML entities in attribute values, so we need
 * to undo the escaping React applied when rendering the attribute.
 */
function decodeReactEscapedAttribute(value: string): string {
    return value
        .replaceAll("&quot;", '"')
        .replaceAll("&#x27;", "'")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&amp;", "&")
}

function escapeHtmlText(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
}

/**
 * Resolve the canonical dimensions query string for a multi-dim page request:
 * every dimension is taken from the request's search params, falling back to
 * the default view's choice. Must produce the same string as
 * multiDimDimensionsToViewQueryStr does at bake time so that sitemap URLs,
 * canonical URLs and view-title lookups all agree.
 */
export function resolveMdimViewQueryStr(
    searchParams: URLSearchParams,
    defaultDimensions: Record<string, string>
): string {
    const dimensions: Record<string, string> = {}
    for (const [dim, defaultChoice] of Object.entries(defaultDimensions)) {
        dimensions[dim] = searchParams.get(dim) ?? defaultChoice
    }
    return multiDimDimensionsToViewQueryStr(dimensions)
}

/**
 * Loads the companion file baked alongside a multi-dim data page (see
 * getMultiDimPageCompanion in the baker). Returns undefined if the file
 * doesn't exist or can't be loaded.
 */
export type MdimCompanionLoader = () => Promise<
    MultiDimPageCompanion | undefined
>

/**
 * Update og:url, og:image, twitter:image meta tags, and JSON-LD image URL
 * to include the search parameters. On multi-dim pages, additionally rewrite
 * the canonical URL to the requested view and — when the request selects a
 * specific view via dimension params — serve that view's grapher title in
 * <title>, og:title, twitter:title and the JSON-LD name, so search engines
 * see view-specific titles instead of the generic multi-dim page title. The
 * view titles come from the page's companion file, loaded via
 * `loadMdimCompanion` only when a view is selected.
 */
export function rewriteMetaTags(
    url: URL,
    openGraphThumbnailUrl: string,
    twitterThumbnailUrl: string,
    page: Response,
    loadMdimCompanion?: MdimCompanionLoader
) {
    // Take the origin (e.g. https://ourworldindata.org) from the canonical URL, which should appear before the image elements.
    // If we fail to capture the origin, we end up with relative image URLs, which should also be okay.
    let origin = ""
    let mdimViewQueryStr: string | undefined = undefined
    let mdimViewTitle: string | undefined = undefined

    const thumbnailUrl = `${url.pathname}.png${url.search}`
    const downloadCtxBase = getDownloadContextBase(url)

    // Buffers for collecting text across chunks
    let jsonLdText = ""
    let titleText = ""

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
        .on("head", {
            // This handler is async: it (potentially) loads the page's
            // companion file, and the rewriter waits for it before streaming
            // any of the head's children — so the view title is known by the
            // time the <title> handler below runs.
            element: async (element) => {
                let mdimDimensionsObj: Record<string, string> | undefined
                const dimensionsAttr = element.getAttribute(
                    "data-owid-mdim-initial-view-dimensions"
                )
                if (dimensionsAttr) {
                    try {
                        mdimDimensionsObj = JSON.parse(
                            decodeReactEscapedAttribute(dimensionsAttr)
                        ) as Record<string, string>
                    } catch (e) {
                        console.error("Error parsing dimensions JSON", e)
                    }
                }
                if (!mdimDimensionsObj) return

                mdimViewQueryStr = resolveMdimViewQueryStr(
                    url.searchParams,
                    mdimDimensionsObj
                )

                // Only serve a view-specific title when the URL explicitly
                // selects a view; the bare mdim URL keeps the generic title.
                const hasDimensionParams = Object.keys(mdimDimensionsObj).some(
                    (dim) => url.searchParams.has(dim)
                )
                if (!hasDimensionParams || !loadMdimCompanion) return
                const companion = await loadMdimCompanion()
                mdimViewTitle = companion?.views?.[mdimViewQueryStr]?.title
            },
        })
        .on("title", {
            text: (text) => {
                if (!mdimViewTitle) return
                // text.text is raw source text with entities intact, so buffer
                // it unchanged and only escape the prepended view title.
                titleText += text.text
                text.remove()
                if (text.lastInTextNode) {
                    text.after(
                        `${escapeHtmlText(mdimViewTitle)} | ${titleText}`,
                        { html: true }
                    )
                }
            },
        })
        .on('meta[property="og:title"], meta[name="twitter:title"]', {
            element: (element) => {
                if (!mdimViewTitle) return
                const content = element.getAttribute("content")
                if (content) {
                    element.setAttribute(
                        "content",
                        `${mdimViewTitle} | ${decodeReactEscapedAttribute(content)}`
                    )
                }
            },
        })
        .on('link[rel="canonical"]', {
            // Rewrite the canonical URL for Multi-Dim pages to preserve only the valid dimension query parameters.
            // This ensures search engines index specific dimension configurations separately while ignoring other query parameters.
            element: (element) => {
                const href = element.getAttribute("href")
                if (href && mdimViewQueryStr) {
                    element.setAttribute("href", href + "?" + mdimViewQueryStr)
                }
            },
        })
        .on('meta[property="og:url"]', {
            // Replace canonical URL, otherwise the preview image will not include the search parameters.
            element: (element) => {
                const canonicalUrl = element.getAttribute("content")
                if (canonicalUrl) {
                    element.setAttribute("content", canonicalUrl + url.search)
                    try {
                        origin = new URL(canonicalUrl).origin
                    } catch (e) {
                        console.error("Error parsing canonical URL", e)
                    }
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
        .on("[data-owid-download-url-target]", {
            element: (element) => {
                const target = element.getAttribute(
                    "data-owid-download-url-target"
                )
                if (!target) return

                const rewrittenUrl = getRewrittenDownloadUrl(
                    target as DownloadRewriteTarget,
                    downloadCtxBase
                )
                if (!rewrittenUrl) return

                const tagName = element.tagName.toLowerCase()
                if (tagName === "a") {
                    element.setAttribute("href", rewrittenUrl)
                } else if (tagName === "code") {
                    element.setInnerContent(rewrittenUrl)
                }
            },
        })
        .on('script[type="application/ld+json"]', {
            element: (element) => {
                jsonLdText = ""
                element.onEndTag((endTag) => {
                    if (!jsonLdText) return
                    endTag.before(
                        rewriteJsonLdText(jsonLdText, url, {
                            viewQueryStr: mdimViewQueryStr,
                            viewTitle: mdimViewTitle,
                        }),
                        {
                            html: true,
                        }
                    )
                })
            },
            text: (text) => {
                jsonLdText += text.text
                text.remove()
            },
        })

    return rewriter.transform(page)
}

export function getDownloadContextBase(url: URL): DataDownloadContextBase {
    const searchParams = new URLSearchParams(url.searchParams)
    const externalSearchParams = new URLSearchParams()
    const grapherQueryParamKeys = new Set<string>(GRAPHER_QUERY_PARAM_KEYS)

    for (const [key, value] of url.searchParams.entries()) {
        if (!grapherQueryParamKeys.has(key)) {
            externalSearchParams.set(key, value)
        }
    }

    return {
        slug: url.pathname.split("/").at(-1) ?? "",
        searchParams,
        externalSearchParams,
        baseUrl: `${url.origin}${url.pathname}`,
    }
}

function getRewrittenDownloadUrl(
    target: DownloadRewriteTarget,
    downloadCtxBase: DataDownloadContextBase
): string | undefined {
    const csvUrl = getDownloadUrl("csv", {
        ...downloadCtxBase,
        csvDownloadType: CsvDownloadType.Full,
        shortColNames: false,
    })
    const metadataUrl = getDownloadUrl("metadata.json", {
        ...downloadCtxBase,
        csvDownloadType: CsvDownloadType.Full,
        shortColNames: false,
    })
    const codeExamples = makeDownloadCodeExamples(csvUrl, metadataUrl)

    switch (target) {
        case "download-full-data":
            return getDownloadUrl("zip", {
                ...downloadCtxBase,
                csvDownloadType: CsvDownloadType.Full,
                shortColNames: false,
            })
        case "download-filtered-data":
            return getDownloadUrl("zip", {
                ...downloadCtxBase,
                csvDownloadType: CsvDownloadType.CurrentSelection,
                shortColNames: false,
            })
        case "api-csv":
            return csvUrl
        case "api-metadata":
            return metadataUrl
        case "api-example-excel":
            return codeExamples["Excel / Google Sheets"]
        case "api-example-python":
            return codeExamples["Python with Pandas"]
        case "api-example-r":
            return codeExamples["R"]
        case "api-example-stata":
            return codeExamples["Stata"]
        default:
            return undefined
    }
}

/**
 * Rewrites inline JSON-LD for grapher pages so embedded asset URLs inherit the
 * current request's query params, then escapes the serialized JSON for safe use
 * inside an inline `<script>` tag.
 *
 * If the parsed JSON-LD contains `image.contentUrl`, each search param from
 * `url` is copied onto that image URL. On multi-dim pages, `url` is rewritten
 * to the requested view (mirroring the canonical URL) and `name` gets the
 * view's grapher title prepended. If parsing fails, the original text is
 * returned unchanged after logging the error.
 *
 * @param jsonLdText - Raw JSON-LD text.
 * @param url - The current request URL whose search params should be preserved.
 * @param mdimView - The multi-dim view the request resolves to, if any.
 * @returns JSON-LD text safe to inline in HTML.
 *
 * @example
 * const rewritten = rewriteJsonLdText(
 *     JSON.stringify({
 *         image: {
 *             contentUrl: "https://ourworldindata.org/grapher/example.png?tab=chart",
 *         },
 *     }),
 *     new URL("https://ourworldindata.org/grapher/example?country=CZE~OWID_EUR")
 * )
 *
 * // `country` is copied onto `image.contentUrl` and the output is escaped so it
 * // can be safely embedded in an inline script tag.
 */
export function rewriteJsonLdText(
    jsonLdText: string,
    url: URL,
    mdimView?: { viewQueryStr?: string; viewTitle?: string }
): string {
    try {
        const data = JSON.parse(jsonLdText) as {
            name?: string
            url?: string
            image?: { contentUrl?: string }
        }

        if (data.image?.contentUrl) {
            const imageUrl = new URL(data.image.contentUrl)
            url.searchParams.forEach((value, key) => {
                imageUrl.searchParams.set(key, value)
            })
            data.image.contentUrl = imageUrl.toString()
        }

        if (mdimView?.viewQueryStr && data.url) {
            data.url = `${data.url}?${mdimView.viewQueryStr}`
        }
        if (mdimView?.viewTitle && data.name) {
            data.name = `${mdimView.viewTitle} | ${data.name}`
        }

        return escapeJSONStringForInlineScript(JSON.stringify(data))
    } catch (e) {
        console.error("Error rewriting JSON-LD", e)
        Sentry.captureException(e)
        return jsonLdText
    }
}

/**
 * Add CSS classes to document body
 */
export function addClassNamesToBody(page: Response, classNames: string[]) {
    const rewriter = new HTMLRewriter().on("body", {
        element(element) {
            const existingClass = element.getAttribute("class")
            element.setAttribute(
                "class",
                `${existingClass ?? ""} ${classNames.join(" ")}`.trim()
            )
        },
    })

    return rewriter.transform(page)
}
