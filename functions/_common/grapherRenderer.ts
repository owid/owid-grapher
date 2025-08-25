import { initWasm, Resvg, type ResvgRenderOptions } from "@resvg/resvg-wasm"
import { TimeLogger } from "./timeLogger.js"
import { png } from "itty-router"

import resvg_wasm from "@resvg/resvg-wasm/index_bg.wasm"

// these are regular .ttf files, but cloudflare needs the .bin extension to serve them correctly
import LatoRegular from "../_common/fonts/LatoLatin-Regular.ttf.bin"
import LatoMedium from "../_common/fonts/LatoLatin-Medium.ttf.bin"
import LatoBold from "../_common/fonts/LatoLatin-Bold.ttf.bin"
import PlayfairSemiBold from "../_common/fonts/PlayfairDisplayLatin-SemiBold.ttf.bin"
import { Env } from "./env.js"
import { ImageOptions, extractOptions } from "./imageOptions.js"
import {
    getDataApiUrl,
    GrapherIdentifier,
    initGrapher,
} from "./grapherTools.js"
import { fetchInputTableForConfig } from "@ourworldindata/grapher"
import ReactDOMServer from "react-dom/server"

declare global {
    var window: any
}

// Lots of defaults; these are mostly the same as they are in owid-grapher.
// Note, however, that these are not being used for Twitter or Facebook images, these use custom sizes defined below.
export const DEFAULT_WIDTH = 850
export const DEFAULT_HEIGHT = 600
export const DEFAULT_ASPECT_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT
export const DEFAULT_NUM_PIXELS = DEFAULT_WIDTH * DEFAULT_HEIGHT
export const MIN_ASPECT_RATIO = 0.5
export const MAX_ASPECT_RATIO = 2
export const MAX_NUM_PNG_PIXELS = 4250 * 3000 // 12.75 megapixels, or 5x the initial resolution, is the maximum png size we generate

async function fetchAndRenderGrapherToSvg(
    identifier: GrapherIdentifier,
    options: ImageOptions,
    searchParams: URLSearchParams,
    env: Env
) {
    const grapherLogger = new TimeLogger("grapher")
    const { grapher } = await initGrapher(
        identifier,
        options,
        searchParams,
        env
    )

    grapherLogger.log("initGrapher")
    const promises = []
    promises.push(
        fetchInputTableForConfig({
            dimensions: grapher.grapherState.dimensions,
            selectedEntityColors: grapher.grapherState.selectedEntityColors,
            dataApiUrl: getDataApiUrl(env),
        })
    )
    if (
        options.details &&
        grapher.grapherState.detailsOrderedByReference.length
    ) {
        promises.push(
            await fetch("https://ourworldindata.org/dods.json")
                .then((r) => r.json())
                .then((details) => {
                    globalThis.window = { details }
                })
        )
    }

    const results = await Promise.all(promises) // Run these (potentially) two fetches in parallel
    grapherLogger.log("fetchDataAndDods")

    const inputTable = results[0]
    if (inputTable) grapher.grapherState.inputTable = inputTable

    const svg = grapher.grapherState.generateStaticSvg(
        ReactDOMServer.renderToStaticMarkup
    )
    grapherLogger.log("generateStaticSvg")

    return { svg, backgroundColor: grapher.grapherState.backgroundColor }
}

export const fetchAndRenderGrapher = async (
    id: GrapherIdentifier,
    searchParams: URLSearchParams,
    outType: "png" | "svg",
    env: Env
) => {
    const options = extractOptions(searchParams)

    console.log("Rendering", id.id, outType, options)
    const { svg, backgroundColor } = await fetchAndRenderGrapherToSvg(
        id,
        options,
        searchParams,
        env
    )
    console.log("fetched svg")

    switch (outType) {
        case "png":
            return png(await renderSvgToPng(svg, options, backgroundColor))
        case "svg":
            return new Response(svg, {
                headers: {
                    "Content-Type": "image/svg+xml",
                },
            })
    }
}

let initialized = false

export async function renderSvgToPng(
    svg: string,
    options: ImageOptions,
    backgroundColor: string
) {
    if (!initialized) {
        await initWasm(resvg_wasm)
        initialized = true
    }

    const opts: ResvgRenderOptions = {
        fitTo: {
            mode: "width",
            value: options.pngWidth,
        },
        background: backgroundColor,
        font: {
            fontBuffers: [
                LatoRegular,
                LatoMedium,
                LatoBold,
                PlayfairSemiBold,
            ].map((f) => new Uint8Array(f)),
        },
    }

    const pngLogger = new TimeLogger("png")
    const resvgJS = new Resvg(svg, opts)

    const pngData = await resvgJS.render().asPng()
    pngLogger.log("svg2png")
    return pngData
}
