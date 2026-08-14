import { newContext, type Context } from "resvg-wasm"
import { TimeLogger } from "./timeLogger.js"
import { png } from "itty-router"

// these are regular .ttf files, but cloudflare needs the .bin extension to serve them correctly
import LatoRegular from "../_common/fonts/LatoLatin-Regular.ttf.bin"
import LatoMedium from "../_common/fonts/LatoLatin-Medium.ttf.bin"
import LatoItalic from "../_common/fonts/LatoLatin-Italic.ttf.bin"
import LatoBold from "../_common/fonts/LatoLatin-Bold.ttf.bin"
import PlayfairSemiBold from "../_common/fonts/PlayfairDisplayLatin-SemiBold.ttf.bin"
import { Env } from "./env.js"
import { ImageOptions, extractOptions } from "./imageOptions.js"
import {
    getDataApiUrl,
    GrapherIdentifier,
    initGrapher,
} from "./grapherTools.js"
import { GRAPHER_TAB_NAMES } from "@ourworldindata/types"
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

    // Prefer to render the default tab rather than an empty table
    if (grapher.grapherState.activeTab === GRAPHER_TAB_NAMES.Table) {
        grapher.grapherState.resetToDefaultTab()
    }

    grapherLogger.log("initGrapher")
    const fetchTablePromise = fetchInputTableForConfig({
        dimensions: grapher.grapherState.dimensions,
        selectedEntityColors: grapher.grapherState.selectedEntityColors,
        dataApiUrl: getDataApiUrl(env),
    })

    let fetchDodsPromise: Promise<void> | undefined
    if (
        options.details &&
        grapher.grapherState.detailsOrderedByReference.length
    ) {
        fetchDodsPromise = fetch("https://ourworldindata.org/dods.json")
            .then((r) => r.json())
            .then((details) => {
                globalThis.window = { details }
            })
    }

    const inputTable = await fetchTablePromise // Run these (potentially) two fetches in parallel
    await fetchDodsPromise
    grapherLogger.log("fetchDataAndDods")

    if (inputTable) grapher.grapherState.inputTable = inputTable

    const svg = await grapher.grapherState.generateStaticSvg(
        ReactDOMServer.renderToStaticMarkup
    )
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

let resvgContext: Promise<Context> | undefined

function getResvgContext(): Promise<Context> {
    resvgContext ??= newContext().then((context) => {
        for (const fontData of [
            LatoRegular,
            LatoMedium,
            LatoItalic,
            LatoBold,
            PlayfairSemiBold,
        ]) {
            context.registerFontData(new Uint8Array(fontData))
        }
        return context
    })
    return resvgContext
}

export async function renderSvgToPng(svg: string, options: ImageOptions) {
    const context = await getResvgContext()

    // resvg-wasm only takes a scale factor, so compute it such that the
    // resulting png is options.pngWidth pixels wide
    const scale = options.pngWidth / options.svgWidth

    const pngLogger = new TimeLogger("png")
    const pngData = context.render(svg, scale)
    if (!pngData) throw new Error("Failed to render SVG to PNG")
    pngLogger.log("svg2png")
    return pngData
}
