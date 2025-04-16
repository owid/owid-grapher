import { writeFile } from "fs/promises"
import { Position } from "geojson"
import prettier from "prettier"
import _, { maxBy, round } from "lodash"
import { GeoFeatures, GeoFeature, EllipseCoords } from "@ourworldindata/grapher"
import { excludeNull, omitUndefinedValues } from "@ourworldindata/utils"
import polylabel from "polylabel"
import { geoMercator, geoPath } from "d3-geo"
import { manualAnnotationPlacementsById } from "./AnnotationPlacements"

const GRAPHER_ROOT = __dirname.replace(/\/(itsJustJavascript\/)?devTools.*/, "")
const GRAPHER_MAP_ANNOTATIONS_PATH = `${GRAPHER_ROOT}/packages/@ourworldindata/grapher/src/mapCharts/MapAnnotationPlacements.json`

const COUNTRIES_WITH_EXTERNAL_LABEL_ONLY = [
    "Chile",
    "Indonesia",
    "East Timor",
    "New Zealand",
]

interface PoleOfInaccessibility {
    x: number // center x
    y: number // center y
    distance: number // distance of the pole to the closest polygon point
}

function prettifiedJson(obj: any): Promise<string> {
    return prettier.format(JSON.stringify(obj), { parser: "json", tabWidth: 4 })
}

// we could use any projection here since annotation placements
// are ultimately stored as lat/lon coordinates
const projection = geoMercator()

/**
 * Find the 'pole of inaccessibility' of a polygon, the most distant internal
 * point from the polygon outline.
 *
 * The 'polylabel' library fits by default a circle into the polygon, but for
 * label placements, fitting an ellipse that is stretched based on the bounding
 * box aspect ratio gives better results.
 *
 * Adapted from https://observablehq.com/d/7c984c2d23c003fe
 */
function calculatePoleOfInaccessibility(
    polygon: Position[][]
): PoleOfInaccessibility {
    // calculate aspect ratio
    const aspectRatio = calculateAspectRatio(polygon)

    // stretch the given polygon
    const stretchedPolygon = polygon.map((ring) => {
        const projectedRing = excludeNull(
            ring.map((pos) => projection(pos as [number, number]))
        )
        return projectedRing.map(([x, y]) => [x / aspectRatio, y])
    })

    // calculate the pole of inaccessibility
    const pole = polylabel(stretchedPolygon, 0.01)

    // stretch the result back
    const x = pole[0] * aspectRatio
    const y = pole[1]
    const distance = pole.distance * aspectRatio

    return { x, y, distance }
}

function calculateAspectRatio(polygon: Position[][]): number {
    const bounds = geoPath().bounds({ type: "Polygon", coordinates: polygon })
    const dx = bounds[1][0] - bounds[0][0]
    const dy = bounds[1][1] - bounds[0][1]
    const ratio = dx / (dy || 1)
    return ratio
}

/**
 * Calculate the 'pole of inaccessibility' ellipse for a polygon.
 * The ellipse determines the label placement inside the polygon.
 */
function calculateLabelEllipseForPolygon(polygon: Position[][]): Ellipse {
    const aspectRatio = calculateAspectRatio(polygon)
    const pole = calculatePoleOfInaccessibility(polygon)
    return {
        cx: pole.x,
        cy: pole.y,
        rx: pole.distance,
        ry: pole.distance / aspectRatio,
    }
}

/**
 * Calculate the 'pole of inaccessibility' ellipse for a geographic feature.
 * The ellipse determines the label placement inside the feature.
 */
function calculateLabelEllipseForGeoFeature(feature: GeoFeature): Ellipse {
    const { geometry } = feature

    // no need to deal with geometries of this type
    if (geometry.type === "GeometryCollection") {
        throw new Error("Unexpected geometry type: GeometryCollection")
    }

    // for multi polygons, pick the longest ellipse
    if (geometry.type === "MultiPolygon") {
        const polygons = geometry.coordinates
        const ellipses = polygons.map((polygon) =>
            calculateLabelEllipseForPolygon(polygon)
        )
        return maxBy(ellipses, (ellipse) => ellipse?.rx)!
    }

    return calculateLabelEllipseForPolygon(geometry.coordinates as Position[][])
}

function makeLabelEllipseCoords(feature: GeoFeature): EllipseCoords {
    const ellipse = calculateLabelEllipseForGeoFeature(feature)

    // Define ellipse by three lon/lat points:
    // - the center of the ellipse
    // - the leftmost point on the x-axis
    // - the topmost point on the y-axis
    const center = projection.invert!([ellipse.cx, ellipse.cy])
    const left = projection.invert!([ellipse.cx - ellipse.rx, ellipse.cy])
    const top = projection.invert!([ellipse.cx, ellipse.cy - ellipse.ry])

    if (!center || !left || !top) {
        throw new Error(`Failed to calculate label ellipse for ${feature.id}`)
    }

    return {
        cx: roundCoord(center[0]),
        cy: roundCoord(center[1]),
        left: roundCoord(left[0]),
        top: roundCoord(top[1]),
    }
}

const roundCoord = (coord: number): number => round(coord, 5)

const roundCoords = (coords: [number, number]): [number, number] => [
    roundCoord(coords[0]),
    roundCoord(coords[1]),
]

async function main() {
    const annotations = GeoFeatures.map((feature: GeoFeature) => {
        const manual = manualAnnotationPlacementsById.get(feature.id as string)

        const shouldHaveInternalAnnotation =
            !COUNTRIES_WITH_EXTERNAL_LABEL_ONLY.includes(feature.id as any)

        let ellipse: EllipseCoords | undefined
        if (shouldHaveInternalAnnotation) {
            ellipse =
                manual?.internal?.ellipse ?? makeLabelEllipseCoords(feature)
        }

        const external = manual?.external
        if (external?.anchorPoint)
            external.anchorPoint = roundCoords(external.anchorPoint)

        if (!ellipse && !external) {
            console.warn(`${feature.id} doesn't have a label placement`)
        }

        return omitUndefinedValues({
            id: feature.id,
            ellipse,
            ...external,
        })
    })

    const json = await prettifiedJson(annotations)
    await writeFile(GRAPHER_MAP_ANNOTATIONS_PATH, json)
}

void main()
