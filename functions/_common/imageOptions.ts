import {
    GrapherProgrammaticInterface,
    GRAPHER_SQUARE_SIZE,
} from "@ourworldindata/grapher"
import {
    DEFAULT_ASPECT_RATIO,
    MIN_ASPECT_RATIO,
    MAX_ASPECT_RATIO,
    MAX_NUM_PNG_PIXELS,
    DEFAULT_NUM_PIXELS,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
} from "./grapherRenderer.js"
import { GrapherStaticFormat } from "@ourworldindata/types"

export interface ImageOptions {
    pngWidth: number
    pngHeight: number
    svgWidth: number
    svgHeight: number
    details: boolean
    fontSize: number | undefined
    grapherProps?: Partial<GrapherProgrammaticInterface>
}
export const TWITTER_OPTIONS: ImageOptions = {
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
const SOCIAL_MEDIA_SQUARE_OPTIONS: ImageOptions = {
    pngWidth: 4 * GRAPHER_SQUARE_SIZE,
    pngHeight: 4 * GRAPHER_SQUARE_SIZE,
    svgWidth: GRAPHER_SQUARE_SIZE,
    svgHeight: GRAPHER_SQUARE_SIZE,
    details: false,
    fontSize: undefined,
    grapherProps: {
        isSocialMediaExport: true,
        staticFormat: GrapherStaticFormat.square,
    },
}

export const extractOptions = (params: URLSearchParams): ImageOptions => {
    // We have two special images types specified via the `imType` query param:
    if (params.get("imType") === "twitter") return TWITTER_OPTIONS
    else if (params.get("imType") === "og") return OPEN_GRAPH_OPTIONS
    else if (params.get("imType") === "social-media-square") {
        const squareOptions = SOCIAL_MEDIA_SQUARE_OPTIONS
        if (params.has("imSquareSize")) {
            const size = parseInt(params.get("imSquareSize")!)
            squareOptions.pngWidth = size
            squareOptions.pngHeight = size
        }
        return squareOptions
    }

    const options: Partial<ImageOptions> = {}

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
