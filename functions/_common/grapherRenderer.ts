import { svg2png, initialize as initializeSvg2Png } from "svg2png-wasm"
import { TimeLogger } from "./timeLogger"
import { png } from "itty-router"

import svg2png_wasm from "../../node_modules/svg2png-wasm/svg2png_wasm_bg.wasm"

// these are regular .ttf files, but cloudflare needs the .bin extension to serve them correctly
import LatoRegular from "../_common/fonts/LatoLatin-Regular.ttf.bin"
import LatoMedium from "../_common/fonts/LatoLatin-Medium.ttf.bin"
import LatoBold from "../_common/fonts/LatoLatin-Bold.ttf.bin"
import PlayfairSemiBold from "../_common/fonts/PlayfairDisplayLatin-SemiBold.ttf.bin"
import { Env } from "./env.js"
import { ImageOptions, extractOptions, initialized } from "./imageOptions.js"
import { GrapherIdentifier, initGrapher } from "./grapherTools.js"

declare global {
    // eslint-disable-next-line no-var
    var window: any
}

export const grapherBaseUrl = "https://ourworldindata.org/grapher"

// Lots of defaults; these are mostly the same as they are in owid-grapher.
// Note, however, that these are not being used for Twitter or Facebook images, these use custom sizes defined below.
export const DEFAULT_WIDTH = 850
export const DEFAULT_HEIGHT = 600
export const DEFAULT_ASPECT_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT
export const DEFAULT_NUM_PIXELS = DEFAULT_WIDTH * DEFAULT_HEIGHT
export const MIN_ASPECT_RATIO = 0.5
export const MAX_ASPECT_RATIO = 2
export const MAX_NUM_PNG_PIXELS = 4250 * 3000 // 12.75 megapixels, or 5x the initial resolution, is the maximum png size we generate

const WORKER_CACHE_TIME_IN_SECONDS = 60

export async function fetchFromR2(
    url: URL,
    etag: string | undefined,
    fallbackUrl?: URL
) {
    const headers = new Headers()
    if (etag) headers.set("If-None-Match", etag)
    const init = {
        cf: {
            cacheEverything: true,
            cacheTtl: WORKER_CACHE_TIME_IN_SECONDS,
        },
        headers,
    }
    const primaryResponse = await fetch(url.toString(), init)
    // The fallback URL here is used so that on staging or dev we can fallback
    // to the production bucket if the file is not found in the branch bucket
    if (primaryResponse.status === 404 && fallbackUrl) {
        return fetch(fallbackUrl.toString(), init)
    }
    return primaryResponse
}

async function fetchAndRenderGrapherToSvg(
    identifier: GrapherIdentifier,
    options: ImageOptions,
    searchParams: URLSearchParams,
    env: Env
) {
    const grapherLogger = new TimeLogger("grapher")
    const grapher = await initGrapher(identifier, options, searchParams, env)

    grapherLogger.log("initGrapher")
    const promises = []
    promises.push(grapher.downloadLegacyDataFromOwidVariableIds())
    if (options.details && grapher.detailsOrderedByReference.length) {
        promises.push(
            await fetch("https://ourworldindata.org/dods.json")
                .then((r) => r.json())
                .then((details) => {
                    globalThis.window = { details }
                })
        )
    }

    await Promise.all(promises) // Run these (potentially) two fetches in parallel
    grapherLogger.log("fetchDataAndDods")

    const svg = grapher.generateStaticSvg()
    grapherLogger.log("generateStaticSvg")
    return svg
}

export const fetchAndRenderGrapher = async (
    id: GrapherIdentifier,
    searchParams: URLSearchParams,
    outType: "png" | "svg",
    env: Env
) => {
    const options = extractOptions(searchParams)

    console.log("Rendering", id.id, outType, options)
    const svg = await fetchAndRenderGrapherToSvg(id, options, searchParams, env)
    console.log("fetched svg")

    switch (outType) {
        case "png":
            return png(await renderSvgToPng(svg, options))
        case "svg":
            return new Response(svg, {
                headers: {
                    "Content-Type": "image/svg+xml",
                },
            })
    }
}

let initialized = false

async function renderSvgToPng(svg: string, options: ImageOptions) {
    if (!initialized) {
        await initializeSvg2Png(svg2png_wasm)
        initialized = true
    }

    const pngLogger = new TimeLogger("png")
    const pngData = await svg2png(svg, {
        width: options.pngWidth,

        // if we include details, pngHeight is only the height of the chart, but we also have an "appendix" at the bottom that we want to include
        height: options.details ? undefined : options.pngHeight,
        backgroundColor: "#fff",
        fonts: [LatoRegular, LatoMedium, LatoBold, PlayfairSemiBold].map(
            (f) => new Uint8Array(f)
        ),
    })
    pngLogger.log("svg2png")
    return pngData
}
