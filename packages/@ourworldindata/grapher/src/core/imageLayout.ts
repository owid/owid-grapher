import { GrapherVariant } from "@ourworldindata/types"
import {
    GRAPHER_SQUARE_SIZE,
    GRAPHER_THUMBNAIL_HEIGHT,
    GRAPHER_THUMBNAIL_WIDTH,
} from "./GrapherConstants"
import {
    ExplicitImageSize,
    ImageRequest,
    ImageSizePreset,
} from "./imageRequest.js"

export interface ImageLayout {
    pngWidth: number
    pngHeight: number
    svgWidth: number
    svgHeight: number
    fontSize: number | undefined
}

const DEFAULT_WIDTH = 850
const DEFAULT_HEIGHT = 600
const DEFAULT_ASPECT_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT
const DEFAULT_NUM_PIXELS = DEFAULT_WIDTH * DEFAULT_HEIGHT
const MIN_ASPECT_RATIO = 0.5
const MAX_ASPECT_RATIO = 2
const MAX_NUM_PNG_PIXELS = 4250 * 3000

const THUMBNAIL_PNG_SCALE = 4
const THUMBNAIL_FONT_SIZE = 14

const PRESET_LAYOUTS: Record<ImageSizePreset, ImageLayout> = {
    twitter: {
        pngWidth: 800,
        pngHeight: 418,
        svgWidth: 800,
        svgHeight: 418,
        fontSize: 21,
    },
    og: {
        pngWidth: 1200,
        pngHeight: 628,
        svgWidth: 800,
        svgHeight: 418,
        fontSize: 21,
    },
    square: {
        pngWidth: 4 * GRAPHER_SQUARE_SIZE,
        pngHeight: 4 * GRAPHER_SQUARE_SIZE,
        svgWidth: GRAPHER_SQUARE_SIZE,
        svgHeight: GRAPHER_SQUARE_SIZE,
        fontSize: undefined,
    },
}

export function resolveImageLayout(request: ImageRequest): ImageLayout {
    if (request.variant === GrapherVariant.Thumbnail)
        return resolveThumbnailLayout(request.size)

    if (request.size.kind === "preset")
        return PRESET_LAYOUTS[request.size.preset]

    return resolveGenericLayout(request.size)
}

function resolveThumbnailLayout(size: ExplicitImageSize): ImageLayout {
    const pngWidth = size.width ?? THUMBNAIL_PNG_SCALE * GRAPHER_THUMBNAIL_WIDTH
    const pngHeight =
        size.height ?? THUMBNAIL_PNG_SCALE * GRAPHER_THUMBNAIL_HEIGHT
    return {
        pngWidth,
        pngHeight,
        svgWidth: pngWidth / THUMBNAIL_PNG_SCALE,
        svgHeight: pngHeight / THUMBNAIL_PNG_SCALE,
        fontSize: size.fontSize ?? THUMBNAIL_FONT_SIZE,
    }
}

function resolveGenericLayout(size: ExplicitImageSize): ImageLayout {
    const { pngWidth, pngHeight } = resolveClampedPngSize(size)

    const factor = getNormalizationFactor(pngWidth, pngHeight)
    const svgWidth = Math.round(pngWidth * factor)
    const svgHeight = Math.round(pngHeight * factor)

    return {
        pngWidth: Math.round(pngWidth),
        pngHeight: Math.round(pngHeight),
        svgWidth,
        svgHeight,
        fontSize:
            size.fontSize ??
            (svgHeight !== DEFAULT_HEIGHT
                ? Math.max(10, svgHeight / 25)
                : undefined),
    }
}

function resolveClampedPngSize({ width, height }: ExplicitImageSize): {
    pngWidth: number
    pngHeight: number
} {
    if (width !== undefined && height !== undefined)
        return limitPngSize(width, height)
    if (width !== undefined)
        return limitPngSize(width, width / DEFAULT_ASPECT_RATIO)
    if (height !== undefined)
        return limitPngSize(height * DEFAULT_ASPECT_RATIO, height)
    return { pngWidth: DEFAULT_WIDTH, pngHeight: DEFAULT_HEIGHT }
}

function limitPngSize(
    width: number,
    height: number
): { pngWidth: number; pngHeight: number } {
    let pngWidth = width
    let pngHeight = height

    const aspectRatio = pngWidth / pngHeight
    if (aspectRatio < MIN_ASPECT_RATIO) pngWidth = pngHeight * MIN_ASPECT_RATIO
    else if (aspectRatio > MAX_ASPECT_RATIO)
        pngHeight = pngWidth / MAX_ASPECT_RATIO

    if (pngWidth * pngHeight > MAX_NUM_PNG_PIXELS) {
        const ratio = Math.sqrt(MAX_NUM_PNG_PIXELS / (pngWidth * pngHeight))
        pngWidth *= ratio
        pngHeight *= ratio
    }

    return { pngWidth, pngHeight }
}

function getNormalizationFactor(pngWidth: number, pngHeight: number): number {
    return Math.sqrt(DEFAULT_NUM_PIXELS / (pngWidth * pngHeight))
}
