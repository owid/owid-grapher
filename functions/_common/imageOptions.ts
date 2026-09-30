import {
    GrapherProgrammaticInterface,
    GRAPHER_SQUARE_SIZE,
    DEFAULT_GRAPHER_BOUNDS_SQUARE,
    GRAPHER_THUMBNAIL_WIDTH,
    GRAPHER_THUMBNAIL_HEIGHT,
} from "@ourworldindata/grapher"
import { Bounds } from "@ourworldindata/utils"
import { GrapherVariant } from "@ourworldindata/types"
import {
    DEFAULT_ASPECT_RATIO,
    MIN_ASPECT_RATIO,
    MAX_ASPECT_RATIO,
    MAX_NUM_PNG_PIXELS,
    DEFAULT_NUM_PIXELS,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
} from "./grapherRenderer.js"

export interface ImageOptions {
    pngWidth: number
    pngHeight: number
    svgWidth: number
    svgHeight: number
    details: boolean
    fontSize: number | undefined
    grapherProps?: Partial<GrapherProgrammaticInterface>
}

export const TWITTER_OPTIONS: Readonly<ImageOptions> = {
    // Twitter cards are 1.91:1 in aspect ratio, and 800x418 is the recommended size
    pngWidth: 800,
    pngHeight: 418,
    svgWidth: 800,
    svgHeight: 418,
    details: false,
    fontSize: 21,
}
const OPEN_GRAPH_OPTIONS: Readonly<ImageOptions> = {
    // Open Graph is used by "everything but Twitter": Facebook, LinkedIn, WhatsApp, Signal, etc.
    pngWidth: 1200,
    pngHeight: 628,
    svgWidth: 800,
    svgHeight: 418,
    details: false,
    fontSize: 21,
}

const getSquareOptions = (params: URLSearchParams): ImageOptions => {
    const options = {
        pngWidth: 4 * GRAPHER_SQUARE_SIZE,
        pngHeight: 4 * GRAPHER_SQUARE_SIZE,
        svgWidth: GRAPHER_SQUARE_SIZE,
        svgHeight: GRAPHER_SQUARE_SIZE,
        details: false,
        fontSize: undefined,
        grapherProps: {
            staticBounds: DEFAULT_GRAPHER_BOUNDS_SQUARE,
        } as Partial<GrapherProgrammaticInterface>,
    }

    if (params.has("imSquareSize")) {
        const size = parseInt(params.get("imSquareSize")!)
        options.pngWidth = size
        options.pngHeight = size
    }

    return options
}

const getThumbnailOptions = (params: URLSearchParams): ImageOptions => {
    const options = {
        pngWidth: 4 * GRAPHER_THUMBNAIL_WIDTH,
        pngHeight: 4 * GRAPHER_THUMBNAIL_HEIGHT,
        svgWidth: GRAPHER_THUMBNAIL_WIDTH,
        svgHeight: GRAPHER_THUMBNAIL_HEIGHT,
        details: false,
        fontSize: 14,
        grapherProps: {
            isSocialMediaExport: false,
            staticBounds: new Bounds(
                0,
                0,
                GRAPHER_THUMBNAIL_WIDTH,
                GRAPHER_THUMBNAIL_HEIGHT
            ),
            variant: GrapherVariant.Thumbnail,
        } as Partial<GrapherProgrammaticInterface>,
    }

    if (params.has("imMinimal")) {
        if (!options.grapherProps) options.grapherProps = {}
        options.grapherProps.useMinimalLabeling =
            params.get("imMinimal")! === "1"
    }

    if (params.has("imFontSize"))
        options.fontSize = parseInt(params.get("imFontSize")!)

    if (params.has("imWidth"))
        options.pngWidth = parseInt(params.get("imWidth")!)

    if (params.has("imHeight"))
        options.pngHeight = parseInt(params.get("imHeight")!)

    // Thumbnails are rendered at a quarter of the requested png size; keep
    // svgWidth/svgHeight in sync since renderSvgToPng derives the png scale
    // factor from them
    options.svgWidth = options.pngWidth / 4
    options.svgHeight = options.pngHeight / 4

    if (!options.grapherProps) options.grapherProps = {}
    options.grapherProps.staticBounds = new Bounds(
        0,
        0,
        options.svgWidth,
        options.svgHeight
    )

    return options
}

/**
 * A thumbnail with no text of its own: the map or chart geometry and nothing
 * else. At the ~170px the all-charts block renders these at, any label is
 * illegible, and an illegible label reads as a rendering fault rather than as
 * information (Marwa, 2026-09-30).
 *
 * Most of the chrome is already gone at this size: `imType=thumbnail` renders
 * with `GrapherVariant.Thumbnail`, and a static export only draws the header
 * and footer for `GrapherVariant.Default` (see Chart.renderStatic), so the
 * title, subtitle, source line and logo never appear. What is left is inside
 * the chart itself, and two existing Grapher flags take it away:
 *
 * - `useMinimalLabeling` drops every legend, including a map's colour scale
 *   and its "No data" key (see showLegend in GrapherState).
 * - `hideSeriesLabels` drops the series names *and* the start/end value
 *   labels that minimal labeling otherwise keeps in their place (see
 *   LineChartThumbnail) — "28.5"/"73.2" at the ends of each line.
 *
 * Both are forced here rather than left to `imMinimal`, so the image this
 * `imType` names is the same image whatever else the query string says.
 *
 * Axis tick labels are not covered: a time series keeps its first and last
 * year. Hiding those means passing `xAxis`/`yAxis` config through, which
 * would overwrite the chart's own axis settings (see initGrapher, where
 * grapherProps is spread over the chart's config).
 */
const getNakedThumbnailOptions = (params: URLSearchParams): ImageOptions => {
    const options = getThumbnailOptions(params)
    options.grapherProps = {
        ...options.grapherProps,
        useMinimalLabeling: true,
        hideSeriesLabels: true,
    }
    return options
}

export const extractOptions = (params: URLSearchParams): ImageOptions => {
    const options: Partial<ImageOptions> = {}

    const imType = params.get("imType")
    // We have some special images types specified via the `imType` query param:
    if (imType === "twitter") return TWITTER_OPTIONS
    else if (imType === "og") return OPEN_GRAPH_OPTIONS
    else if (imType === "thumbnail") return getThumbnailOptions(params)
    else if (imType === "naked-thumbnail")
        return getNakedThumbnailOptions(params)
    else if (imType === "square") return getSquareOptions(params)

    if (imType === "uncaptioned") {
        if (!options.grapherProps) options.grapherProps = {}
        options.grapherProps.variant = GrapherVariant.Uncaptioned
        if (params.has("imMinimal")) {
            options.grapherProps.useMinimalLabeling =
                params.get("imMinimal")! === "1"
        }
    }

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
