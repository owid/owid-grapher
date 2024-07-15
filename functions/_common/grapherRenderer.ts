import { Grapher, GrapherInterface } from "@ourworldindata/grapher"
import { Bounds, deserializeJSONFromHTML } from "@ourworldindata/utils"
import { svg2png, initialize as initializeSvg2Png } from "svg2png-wasm"
import { TimeLogger } from "./timeLogger"
import { png } from "itty-router"

import svg2png_wasm from "../../node_modules/svg2png-wasm/svg2png_wasm_bg.wasm"

// these are regular .ttf files, but cloudflare needs the .bin extension to serve them correctly
import LatoRegular from "../_common/fonts/LatoLatin-Regular.ttf.bin"
import LatoMedium from "../_common/fonts/LatoLatin-Medium.ttf.bin"
import LatoBold from "../_common/fonts/LatoLatin-Bold.ttf.bin"
import PlayfairSemiBold from "../_common/fonts/PlayfairDisplayLatin-SemiBold.ttf.bin"
import { Env } from "../grapher/thumbnail/[slug].js"
import { OwidTable } from "@ourworldindata/core-table"

declare global {
    // eslint-disable-next-line no-var
    var window: any
}

const grapherBaseUrl = "https://ourworldindata.org/grapher"

// Lots of defaults; these are mostly the same as they are in owid-grapher.
// Note, however, that these are not being used for Twitter or Facebook images, these use custom sizes defined below.
const DEFAULT_WIDTH = 850
const DEFAULT_HEIGHT = 600
const DEFAULT_ASPECT_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT
const DEFAULT_NUM_PIXELS = DEFAULT_WIDTH * DEFAULT_HEIGHT
const MIN_ASPECT_RATIO = 0.5
const MAX_ASPECT_RATIO = 2
const MAX_NUM_PNG_PIXELS = 4250 * 3000 // 12.75 megapixels, or 5x the initial resolution, is the maximum png size we generate

interface ImageOptions {
    pngWidth: number
    pngHeight: number
    svgWidth: number
    svgHeight: number
    details: boolean
    fontSize: number
}

const TWITTER_OPTIONS: ImageOptions = {
    // Twitter cards are 1.91:1 in aspect ratio, and 800x418 is the recommended size
    pngWidth: 800,
    pngHeight: 418,
    svgWidth: 800,
    svgHeight: 418,
    details: false,
    fontSize: 21,
}

const OPEN_GRAPH_OPTIONS: ImageOptions = {
    // Open Graph is used by "everything but Twitter": Facebook, LinkedIn, WhatsApp, Signal, etc.
    pngWidth: 1200,
    pngHeight: 628,
    svgWidth: 800,
    svgHeight: 418,
    details: false,
    fontSize: 21,
}

let initialized = false

const extractOptions = (params: URLSearchParams): ImageOptions => {
    const options: Partial<ImageOptions> = {}

    // We have two special images types specified via the `imType` query param:
    if (params.get("imType") === "twitter") return TWITTER_OPTIONS
    else if (params.get("imType") === "og") return OPEN_GRAPH_OPTIONS

    // Otherwise, query params can specify the size to be rendered at; and in addition we're doing a
    // bunch of normalization to make sure the image is rendered at a reasonable size and aspect ratio.

    if (params.has("imWidth"))
        options.pngWidth = parseInt(params.get("imWidth")!)
    if (params.has("imHeight"))
        options.pngHeight = parseInt(params.get("imHeight")!)
    options.details = params.get("imDetails") === "1"
    if (params.has("imFontSize"))
        options.fontSize = parseInt(params.get("imFontSize")!)

    // If only one dimension is specified, use the default aspect ratio
    if (options.pngWidth && !options.pngHeight)
        options.pngHeight = options.pngWidth / DEFAULT_ASPECT_RATIO
    else if (options.pngHeight && !options.pngWidth)
        options.pngWidth = options.pngHeight * DEFAULT_ASPECT_RATIO

    if (options.pngWidth && options.pngHeight) {
        // Clamp to min/max aspect ratio
        const aspectRatio = options.pngWidth / options.pngHeight
        if (aspectRatio < MIN_ASPECT_RATIO) {
            options.pngWidth = options.pngHeight * MIN_ASPECT_RATIO
        } else if (aspectRatio > MAX_ASPECT_RATIO) {
            options.pngHeight = options.pngWidth / MAX_ASPECT_RATIO
        }

        // Cap image size to MAX_NUM_PNG_PIXELS
        if (options.pngWidth * options.pngHeight > MAX_NUM_PNG_PIXELS) {
            const ratio = Math.sqrt(
                MAX_NUM_PNG_PIXELS / (options.pngWidth * options.pngHeight)
            )
            options.pngWidth *= ratio
            options.pngHeight *= ratio
        }

        // Grapher is best rendered at a resolution close to 850x600, because otherwise some elements are
        // comically small (e.g. our logo, the map legend, etc). So we create the svg at a lower resolution,
        // but if we are returning a png we render it at the requested resolution.
        const factor = Math.sqrt(
            DEFAULT_NUM_PIXELS / (options.pngWidth * options.pngHeight)
        )
        options.svgWidth = Math.round(options.pngWidth * factor)
        options.svgHeight = Math.round(options.pngHeight * factor)

        options.pngWidth = Math.round(options.pngWidth)
        options.pngHeight = Math.round(options.pngHeight)
    } else {
        options.pngWidth = options.svgWidth = DEFAULT_WIDTH
        options.pngHeight = options.svgHeight = DEFAULT_HEIGHT
    }

    if (
        !options.fontSize &&
        options.svgHeight &&
        options.svgHeight !== DEFAULT_HEIGHT
    ) {
        options.fontSize = Math.max(10, options.svgHeight / 25)
    }

    return options as ImageOptions
}

async function initGrapher(
    {
        slug,
        options,
        searchParams,
        env,
    }: {
        slug: string
        options: ImageOptions
        searchParams: URLSearchParams
        env: Env
    },
    grapherLogger: TimeLogger
) {
    // Fetch grapher config and extract it from the HTML
    const grapherConfig: GrapherInterface = await env.ASSETS.fetch(
        new URL(`/grapher/${slug}`, env.url)
    )
        .then((r) => (r.ok ? r : Promise.reject("Failed to load grapher page")))
        .then((r) => r.text())
        .then((html) => deserializeJSONFromHTML(html))

    if (!grapherConfig) {
        throw new Error("Could not find grapher config")
    }

    grapherLogger.log("fetchGrapherConfig")

    const bounds = new Bounds(0, 0, options.svgWidth, options.svgHeight)
    const grapher = new Grapher({
        ...grapherConfig,
        bakedGrapherURL: grapherBaseUrl,
        queryStr: "?" + searchParams.toString(),
        bounds,
        staticBounds: bounds,
        baseFontSize: options.fontSize,
    })
    grapher.shouldIncludeDetailsInStaticExport = options.details

    grapherLogger.log("grapherInit")
    return grapher
}

export async function fetchMetadataForGrapher(
    slug: string,
    env: Env,
    searchParams?: URLSearchParams
) {
    const grapherLogger = new TimeLogger("grapher")
    console.log("Initializing grapher")
    const grapher = await initGrapher(
        {
            slug,
            options: TWITTER_OPTIONS,
            searchParams: searchParams ?? new URLSearchParams(""),
            env,
        },
        grapherLogger
    )
    console.log("Downloading data")
    await grapher.downloadLegacyDataFromOwidVariableIds()
    console.log("Getting defs")
    const defs = grapher.inputTable
        .getColumns(grapher.inputTable.columnNames)
        .map((col) => col.def)
    console.log("Returning response")
    return new Response(JSON.stringify(defs), {
        headers: {
            "Content-Type": "application/json",
        },
    })
}

export async function fetchZipForGrapher(
    slug: string,
    env: Env,
    searchParams?: URLSearchParams
) {
    const grapherLogger = new TimeLogger("grapher")
    const grapher = await initGrapher(
        {
            slug,
            options: TWITTER_OPTIONS,
            searchParams: searchParams ?? new URLSearchParams(""),
            env,
        },
        grapherLogger
    )
    await grapher.downloadLegacyDataFromOwidVariableIds()
    const defs = grapher.inputTable
        .getColumns(grapher.inputTable.columnNames)
        .map((col) => col.def)
    const table =
        searchParams.get("csvType") === "filtered"
            ? grapher.transformedTable
            : grapher.inputTable
    const json = JSON.stringify(defs)
    const zip = new JSZip()
    zip.file("metadata.json", json)
    zip.file("data.csv", table.toPrettyCsv())
    const content = await zip.generateAsync({ type: "blob" })
    return new Response(content, {
        headers: {
            "Content-Type": "application/zip",
        },
    })
}

export async function fetchCsvForGrapher(
    slug: string,
    env: Env,
    searchParams?: URLSearchParams
) {
    const grapherLogger = new TimeLogger("grapher")
    const grapher = await initGrapher(
        {
            slug,
            options: TWITTER_OPTIONS,
            searchParams: searchParams ?? new URLSearchParams(""),
            env,
        },
        grapherLogger
    )
    await grapher.downloadLegacyDataFromOwidVariableIds()
    const table =
        searchParams.get("csvType") === "filtered"
            ? grapher.transformedTable
            : grapher.inputTable
    return new Response(table.toPrettyCsv(), {
        headers: {
            "Content-Type": "text/csv",
        },
    })
}

export async function fetchReadmeForGrapher(
    slug: string,
    env: Env,
    searchParams?: URLSearchParams
) {
    console.log("Initializing grapher")
    const grapherLogger = new TimeLogger("grapher")
    const grapher = await initGrapher(
        {
            slug,
            options: TWITTER_OPTIONS,
            searchParams: searchParams ?? new URLSearchParams(""),
            env,
        },
        grapherLogger
    )
    console.log("Downloading data")
    await grapher.downloadLegacyDataFromOwidVariableIds()
    console.log("Getting defs")
    const sources = grapher.inputTable
        .getColumns(grapher.inputTable.columnNames)
        .map(
            (col) => `{## ${col.def.name}}
${col.def.description}
    `
        )
    console.log("Returning response")

    const readme = `# ${grapher.title} - Data package

This data package contains the data that powers the chart ["${grapher.title}"](${grapher.originUrl}) on the Our World in Data website.
The source of this data is ${grapher.sourceDesc}.

## Individual time series information

${sources.join("\n")}

    `
    return new Response(readme, {
        headers: {
            "Content-Type": "text/markdown",
        },
    })
}

async function fetchAndRenderGrapherToSvg({
    slug,
    options,
    searchParams,
    env,
}: {
    slug: string
    options: ImageOptions
    searchParams: URLSearchParams
    env: Env
}) {
    const grapherLogger = new TimeLogger("grapher")
    const grapher = await initGrapher(
        { slug, options, searchParams, env },
        grapherLogger
    )
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
    slug: string,
    searchParams: URLSearchParams,
    outType: "png" | "svg",
    env: Env
) => {
    const options = extractOptions(searchParams)

    console.log("Rendering", slug, outType, options)
    const svg = await fetchAndRenderGrapherToSvg({
        slug,
        options,
        searchParams,
        env,
    })

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
