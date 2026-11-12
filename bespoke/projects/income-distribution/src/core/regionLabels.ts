import { Delaunay } from "d3-delaunay"

import type { Region } from "./types.js"

/** A region's band of the stack in pixel space, one point per grid column */
export interface RegionBandPixels {
    region: Region
    points: { x: number; top: number; bottom: number }[]
}

export interface RegionLabel {
    region: Region
    /** Centre of the label */
    x: number
    y: number
    fontSize: number
}

const DEFAULT_FONT_SIZES = [16, 15, 14, 13, 12, 11, 10, 9] as const
const DEFAULT_CHAR_WIDTH_RATIO = 0.55

/** Share of the inscribed circle's diameter a label may use, for breathing room */
const COMFORT_MARGIN = 0.75
/** Candidate label centres searched per band */
const SEARCH_COLUMNS = 50
const SEARCH_ROWS = 40
/** Columns of the band thinner than this (px) aren't considered at all */
const MIN_COLUMN_HEIGHT = 10
/**
 * Longest outline segment (px, in aspect-scaled space) before it's split, so
 * that the nearest outline vertex is a good stand-in for the nearest edge
 */
const MAX_SEGMENT_LENGTH = 4

/**
 * Places each region's name inside its band at the largest font size from
 * `fontSizes` that fits, or leaves the region out when none does. Finds the
 * spot via a text-aspect-weighted pole of inaccessibility: scale x by the
 * text's width/height ratio, build a Delaunay triangulation of the band's
 * subdivided outline, and grid-search for the interior point farthest from
 * the outline (d3-delaunay `find`). Half that distance, scaled back, bounds
 * the font size.
 */
export function placeRegionLabels(
    bands: RegionBandPixels[],
    options: {
        fontSizes?: readonly number[]
        /** Approximate glyph width as a fraction of font size, default 0.55 */
        charWidthRatio?: number
        /**
         * The label's width as a multiple of its font size, measured; more
         * exact than `charWidthRatio`, which it replaces when given
         */
        measureAspect?: (label: string) => number
    } = {}
): RegionLabel[] {
    const fontSizes = [...(options.fontSizes ?? DEFAULT_FONT_SIZES)].sort(
        (a, b) => b - a
    )
    const charWidthRatio = options.charWidthRatio ?? DEFAULT_CHAR_WIDTH_RATIO
    const aspectOf = (label: string): number =>
        options.measureAspect?.(label) ?? label.length * charWidthRatio

    const labels: RegionLabel[] = []
    for (const band of bands) {
        const spot = findLabelSpot(band, aspectOf(band.region), fontSizes)
        if (spot) labels.push({ region: band.region, ...spot })
    }
    return labels
}

/**
 * Where to put a label of the given aspect ratio (width/height) in the band,
 * and at which of `fontSizes` (largest first): the largest size that fits
 * anywhere, placed at the spot nearest the band's centre of area among those
 * that fit it, so a label sits over the bulk of its region rather than
 * wherever a tall, narrow peak happens to leave the most room.
 *
 * Dividing x by the aspect ratio turns a text-shaped rectangle into a square,
 * so plain Euclidean distance to the outline then measures how well a label
 * fits: half that distance, scaled back, bounds the font size.
 */
function findLabelSpot(
    band: RegionBandPixels,
    textAspect: number,
    fontSizes: readonly number[]
): { x: number; y: number; fontSize: number } | undefined {
    const { points } = band
    const n = points.length
    if (n < 2 || textAspect <= 0) return undefined
    const xScale = 1 / textAspect

    let outline: Float64Array | undefined
    let delaunay: Delaunay<number> | undefined
    const candidates: { x: number; y: number; distSq: number }[] = []
    // Centre of area, accumulated per searched column
    let areaSum = 0
    let areaX = 0
    let areaY = 0

    for (let col = 1; col < SEARCH_COLUMNS; col++) {
        // Interpolate the band's edges at this column
        const index = (col / SEARCH_COLUMNS) * (n - 1)
        const i0 = Math.floor(index)
        const i1 = Math.min(i0 + 1, n - 1)
        const frac = index - i0
        const lerp = (a: number, b: number): number => a + (b - a) * frac
        const x = lerp(points[i0].x, points[i1].x)
        const top = lerp(points[i0].top, points[i1].top)
        const bottom = lerp(points[i0].bottom, points[i1].bottom)

        const height = bottom - top
        if (height <= MIN_COLUMN_HEIGHT) continue
        areaSum += height
        areaX += height * x
        areaY += (height * (top + bottom)) / 2

        // Only triangulate once a column is worth searching
        outline ??= traceOutline(band, xScale)
        delaunay ??= new Delaunay(outline)

        for (let row = 1; row < SEARCH_ROWS; row++) {
            const y = top + (row / SEARCH_ROWS) * height
            const nearest = delaunay.find(x * xScale, y)
            const dx = x * xScale - outline[nearest * 2]
            const dy = y - outline[nearest * 2 + 1]
            candidates.push({ x, y, distSq: dx * dx + dy * dy })
        }
    }
    if (candidates.length === 0) return undefined

    // The largest size that fits anywhere
    const bestClearance = Math.sqrt(
        Math.max(...candidates.map((c) => c.distSq))
    )
    const fontSize = fontSizes.find(
        (size) => size <= bestClearance * 2 * COMFORT_MARGIN
    )
    if (fontSize === undefined) return undefined

    // Of the spots that fit it, the one nearest the band's centre of area
    const minDistSq = (fontSize / (2 * COMFORT_MARGIN)) ** 2
    const centreX = areaX / areaSum
    const centreY = areaY / areaSum
    let nearest = candidates[0]
    let nearestDist = Infinity
    for (const candidate of candidates) {
        if (candidate.distSq < minDistSq) continue
        const dx = (candidate.x - centreX) * xScale
        const dy = candidate.y - centreY
        const dist = dx * dx + dy * dy
        if (dist < nearestDist) {
            nearest = candidate
            nearestDist = dist
        }
    }

    return { x: nearest.x, y: nearest.y, fontSize }
}

/**
 * The band's closed outline in aspect-scaled space as flat [x, y, …]
 * coordinates: top edge left to right, right edge down, bottom edge right
 * to left, left edge up, with every segment split into short pieces
 */
function traceOutline(band: RegionBandPixels, xScale: number): Float64Array {
    const { points } = band
    const corners: [number, number][] = [
        ...points.map((p): [number, number] => [p.x * xScale, p.top]),
        ...points
            .toReversed()
            .map((p): [number, number] => [p.x * xScale, p.bottom]),
    ]

    const coords: number[] = []
    for (let i = 0; i < corners.length; i++) {
        const [x0, y0] = corners[i]
        // Wrapping around closes the outline with the left edge
        const [x1, y1] = corners[(i + 1) % corners.length]
        const pieces = Math.max(
            1,
            Math.ceil(Math.hypot(x1 - x0, y1 - y0) / MAX_SEGMENT_LENGTH)
        )
        for (let s = 0; s < pieces; s++) {
            const t = s / pieces
            coords.push(x0 + t * (x1 - x0), y0 + t * (y1 - y0))
        }
    }
    return Float64Array.from(coords)
}
