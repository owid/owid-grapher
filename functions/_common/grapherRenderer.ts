import { Grapher, GrapherInterface } from "@ourworldindata/grapher"
import {
    Bounds,
    deserializeJSONFromHTML,
    excludeUndefined,
    formatSourceDate,
    getAttributionFragmentsFromVariable,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    getPhraseForProcessingLevel,
    OwidColumnDef,
    OwidTableSlugs,
    getDateRange,
    uniq,
    getCitationShort,
    getCitationLong,
    prepareSourcesForDisplay,
    uniqBy,
} from "@ourworldindata/utils"
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
import { CoreColumn } from "@ourworldindata/core-table"
import { toJS } from "mobx"

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

function* columnReadmeText(col: CoreColumn) {
    const def = col.def as OwidColumnDef

    const title = getTitle(col)
    yield `## ${title}`

    yield* getDescription(def)

    yield ""

    const attribution = getAttribution(def)

    const source = getSource(attribution, def)
    yield `Source: ${source}`

    yield* getKeyDataLinex(def, col)

    yield* getDescriptionLines(def, attribution)

    yield* getSources(def)

    yield* getDataProcessingLines(def)

    yield* getCitationLines(def, col)
    yield ""
}

function* getCitationLines(def: OwidColumnDef, col: CoreColumn) {
    yield "### How to cite this data"
    yield "#### In-line citation"
    yield `If you have limited space (e.g. in data visualizations), you can use this abbreviated in-line citation:`
    const citationShort = getCitationShort(
        def.origins ?? [],
        getAttributionFragmentsFromVariable(def),
        def.owidProcessingLevel
    )
    yield citationShort

    yield "#### Full citation"
    const citationLong = getCitationLong(
        col.titlePublicOrDisplayName,
        def.origins ?? [],
        col.source ?? {},
        getAttributionFragmentsFromVariable(def),
        def.presentation?.attributionShort,
        def.presentation?.titleVariant,
        def.owidProcessingLevel,
        undefined
    )
    yield citationLong
}

function* getDataProcessingLines(def: OwidColumnDef) {
    yield "### How we process data at Our World In Data"
    yield `All data and visualizations on Our World in Data rely on data sourced from one or several original data providers. Preparing this original data involves several processing steps. Depending on the data, this can include standardizing country names and world region definitions, converting units, calculating derived indicators such as per capita measures, as well as adding or adapting metadata such as the name or the description given to an indicator.`
    yield `At the link below you can find a detailed description of the structure of our data pipeline, including links to all the code used to prepare data across Our World in Data.`
    yield `[Read about our data pipeline](https://docs.owid.io/projects/etl/)`
    if (def.descriptionProcessing)
        yield `#### Notes on our processing step for this indicator
${def.descriptionProcessing}`
}

function* getDescriptionLines(def: OwidColumnDef, attribution: string) {
    const descriptionKey = def.descriptionKey
    if (descriptionKey)
        yield `### What you should know about this data
${descriptionKey.map((desc) => `* ${desc.trim()}`).join("\n")}`

    if (def.descriptionFromProducer) {
        yield `### How is this data described by its producer - ${attribution}?`
        yield def.descriptionFromProducer.trim()
    }

    if (def.additionalInfo) {
        yield `### Additional information about this data`
        yield def.additionalInfo.trim()
    }
}

function* getKeyDataLinex(def: OwidColumnDef, col: CoreColumn) {
    const lastUpdated = getLastUpdatedFromVariable(def)
    if (lastUpdated)
        yield `Last updated: ${formatSourceDate(lastUpdated, "MMMM D, YYYY")}`

    const nextUpdate = getNextUpdateFromVariable(def)
    if (nextUpdate)
        yield `Next update: ${formatSourceDate(nextUpdate, "MMMM YYYY")}`

    const dateRange = def.timespan ? getDateRange(def.timespan) : undefined
    if (dateRange) yield `Date range: ${dateRange}`

    const unit = def.unit
    if (unit) yield `Unit: ${unit}`

    const unitConversionFactor =
        col.unitConversionFactor && col.unitConversionFactor !== 1
            ? col.unitConversionFactor
            : undefined
    if (unitConversionFactor)
        yield `Unit conversion factor: ${unitConversionFactor}`
}

function yieldMultilineTextAsLines(line: string) {
    return line.split("\n").map((l) => l.trim())
}

function* getSources(def: OwidColumnDef) {
    const sourcesForDisplay = uniqBy(prepareSourcesForDisplay(def), "label")
    for (const source of sourcesForDisplay) {
        yield `#### ${source.label}`
        if (source.description)
            yield* yieldMultilineTextAsLines(source.description).map(
                (l) => `> ${l}`
            )
        if (source.dataPublishedBy)
            yield `Data published by: ${source.dataPublishedBy.trim()}`
        if (source.retrievedOn)
            yield `Retrieved on: ${source.retrievedOn.trim()}`
        if (source.retrievedFrom)
            yield `Retrieved from: ${source.retrievedFrom.trim()}`
        if (source.citation) {
            yield "##### Citation"
            yield "This is the citation of the original data obtained from the source, prior to any processing or adaptation by Our World in Data."
            yield* yieldMultilineTextAsLines(source.citation).map(
                (l) => `> ${l}`
            )
        }
    }
}

function getSource(attribution: string, def: OwidColumnDef) {
    const processingLevelPhrase =
        attribution.toLowerCase() !== "our world in data"
            ? getPhraseForProcessingLevel(def.owidProcessingLevel)
            : undefined
    const fullProcessingPhrase = processingLevelPhrase
        ? ` – ${processingLevelPhrase} by Our World In Data`
        : ""
    const source = `${attribution}${fullProcessingPhrase}`
    return source
}

function getAttribution(def: OwidColumnDef) {
    const producers = uniq(
        excludeUndefined((def.origins ?? []).map((o) => o.producer))
    )

    const attributionFragments =
        getAttributionFragmentsFromVariable(def) ?? producers
    const attribution = attributionFragments.join(", ")
    return attribution
}

function* getDescription(def: OwidColumnDef) {
    const description = def.descriptionShort || def.description
    if (description) yield yieldMultilineTextAsLines(description)
}

function getTitle(col: CoreColumn) {
    let title = col.titlePublicOrDisplayName.title
    if (
        col.titlePublicOrDisplayName.attributionShort &&
        col.titlePublicOrDisplayName.titleVariant
    )
        title = `${title} – ${col.titlePublicOrDisplayName.titleVariant} – ${col.titlePublicOrDisplayName.attributionShort}`
    else if (col.titlePublicOrDisplayName.titleVariant)
        title = `${title} – ${col.titlePublicOrDisplayName.titleVariant}`
    else if (col.titlePublicOrDisplayName.attributionShort)
        title = `${title} – ${col.titlePublicOrDisplayName.attributionShort}`
    return title
}

export function sleep(time: number, value: unknown): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(() => {
            return resolve(value)
        }, time)
    })
}

export async function fetchReadmeForGrapher(
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

    const columnsToIgnore = new Set(
        [
            OwidTableSlugs.entityId,
            OwidTableSlugs.time,
            OwidTableSlugs.entityColor,
            OwidTableSlugs.entityName,
            OwidTableSlugs.entityCode,
            OwidTableSlugs.year,
        ].map((slug) => slug.toString())
    )

    const columnsToGet = grapher.inputTable.columnSlugs.filter(
        (col) => !columnsToIgnore.has(col)
    )

    const columns = grapher.inputTable.getColumns(columnsToGet)
    const sources = columns.flatMap((col) => [...columnReadmeText(toJS(col))])

    const readme = `# ${grapher.title} - Data package

This data package contains the data that powers the chart ["${grapher.title}"](${grapher.originUrl}) on the Our World in Data website.
The source of this data in compact form is: ${grapher.sourcesLine}.

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
