/**
 * The largest dot-free right triangle tucked into one corner of a panel.
 *
 * The static chart this viz grew out of shaded the corner of each panel
 * where no countries sit: highly democratic countries are rarely poor, rarely
 * have high child mortality, and so on. Here that triangle is recomputed for
 * whatever year the slider is on, so it grows and shrinks with the data.
 *
 * Everything is in normalized panel coordinates: `u` and `v` run from 0 to 1
 * across the plot area, and the corner is given as `(cornerU, cornerV)`, each
 * 0 or 1. The triangle's two legs run along the panel edges meeting at that
 * corner; `legU` and `legV` are their lengths, also in [0, 1].
 */

export interface NormalizedPoint {
    u: number
    v: number
}

export interface Corner {
    u: 0 | 1
    v: 0 | 1
}

export interface CornerTriangle {
    corner: Corner
    /** Length of the leg along the u (horizontal) edge */
    legU: number
    /** Length of the leg along the v (vertical) edge */
    legV: number
}

/** Ratios legV / legU to try, from flat (1:5) through square to tall (5:1) */
const ASPECT_RATIOS = Array.from({ length: 41 }, (_, i) =>
    Math.pow(5, (i - 20) / 20)
)

/**
 * Find the largest empty triangle in `corner`.
 *
 * For a fixed shape (ratio r = legV / legU), a point at distances (p, q) from
 * the corner's two edges lies outside the triangle iff p / legU + q / legV >= 1,
 * i.e. legU <= p + q / r. So the biggest empty triangle of that shape has
 * legU = min over points of (p + q / r), and we pick the shape with the
 * largest area legU * legV / 2.
 *
 * `margin` (also normalized) keeps the hypotenuse clear of the dots' edges
 * rather than just their centres. Returns undefined when the triangle would
 * be too small to read (either leg shorter than `minLeg`).
 */
export function findEmptyCornerTriangle(
    points: NormalizedPoint[],
    corner: Corner,
    { margin = 0, minLeg = 0.08 }: { margin?: number; minLeg?: number } = {}
): CornerTriangle | undefined {
    const distances = points.map((point) => ({
        p: Math.max(0, Math.abs(corner.u - point.u)),
        q: Math.max(0, Math.abs(corner.v - point.v)),
    }))

    let best: CornerTriangle | undefined
    let bestArea = 0
    for (const ratio of ASPECT_RATIOS) {
        let legU = 1
        for (const { p, q } of distances) {
            const limit = p + q / ratio
            if (limit < legU) legU = limit
        }
        legU -= margin
        // Neither leg may run past the far edge of the panel
        legU = Math.min(legU, 1, 1 / ratio)
        const legV = legU * ratio
        if (legU <= 0 || legV <= 0) continue
        const area = legU * legV
        if (area > bestArea) {
            bestArea = area
            best = { corner, legU, legV }
        }
    }

    if (!best || best.legU < minLeg || best.legV < minLeg) return undefined
    return best
}

/** The triangle's three vertices in normalized coordinates */
export function getTriangleVertices(
    triangle: CornerTriangle
): [NormalizedPoint, NormalizedPoint, NormalizedPoint] {
    const { corner, legU, legV } = triangle
    const directionU = corner.u === 0 ? 1 : -1
    const directionV = corner.v === 0 ? 1 : -1
    return [
        { u: corner.u, v: corner.v },
        { u: corner.u + directionU * legU, v: corner.v },
        { u: corner.u, v: corner.v + directionV * legV },
    ]
}
