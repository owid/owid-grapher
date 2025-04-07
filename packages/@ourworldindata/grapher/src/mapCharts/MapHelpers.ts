import { Quadtree } from "d3-quadtree"
import { geoOrthographic, geoPath, GeoPermissibleObjects } from "d3-geo"
import {
    EntityName,
    Bounds,
    getAggregates,
    getContinents,
    getIncomeGroups,
    getMemberNamesOfRegion,
    getRelativeMouse,
    lazy,
    MapRegionName,
    sortBy,
} from "@ourworldindata/utils"
import {
    DEFAULT_GLOBE_SIZE,
    ANNOTATION_FONT_SIZE_DEFAULT,
    ANNOTATION_FONT_SIZE_MIN,
    Direction,
    Ellipse,
    GEO_FEATURES_CLASSNAME,
    MAP_HOVER_TARGET_RANGE,
    RenderFeature,
} from "./MapChartConstants"
import { SelectionArray } from "../selection/SelectionArray.js"
import { MapTopology } from "./MapTopology.js"
import { GeoProjection } from "d3"

export function detectNearbyFeature<Feature extends RenderFeature>({
    quadtree,
    element,
    event,
    distance = MAP_HOVER_TARGET_RANGE,
}: {
    quadtree: Quadtree<Feature>
    element: SVGGElement
    event: MouseEvent | TouchEvent
    distance?: number
}): Feature | undefined {
    const groupElement = element.querySelector(`.${GEO_FEATURES_CLASSNAME}`)
    if (!groupElement) {
        console.error(`.${GEO_FEATURES_CLASSNAME} doesn't exist`)
        return
    }

    const { x, y } = getRelativeMouse(groupElement, event)
    return quadtree.find(x, y, distance)
}

export const sortFeaturesByInteractionState = <Feature extends RenderFeature>(
    features: Feature[],
    {
        isHovered,
        isSelected,
    }: {
        isHovered: (featureId: string) => boolean
        isSelected: (featureId: string) => boolean
    }
): Feature[] => {
    return sortBy(features, (feature) => {
        if (isHovered(feature.id)) return 2
        if (isSelected(feature.id)) return 1
        return 0
    })
}

export const calculateDistance = (
    p1: [number, number],
    p2: [number, number]
): number => {
    return Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
}

export function getForegroundFeatures<Feature extends RenderFeature>(
    features: Feature[],
    selectionArray: SelectionArray
): Feature[] {
    const { selectedEntityNames } = selectionArray

    const foregroundCountries = new Set<string>()
    for (const entityName of selectedEntityNames) {
        const countriesByRegion = getCountriesByRegion(entityName)
        if (countriesByRegion) {
            countriesByRegion.forEach((country) =>
                foregroundCountries.add(country)
            )
        }
    }

    if (foregroundCountries.size === 0) return features

    return features.filter((feature) => foregroundCountries.has(feature.id))
}

// A map of the form:
// - Africa: [Algeria, Angola, ...]
// - North America: [Canada, United States, ...]
const countriesByRegionMap = lazy(
    () =>
        new Map(
            [...getContinents(), ...getAggregates(), ...getIncomeGroups()].map(
                (region) => [
                    region.name,
                    new Set(getMemberNamesOfRegion(region)),
                ]
            )
        )
)

export const getCountriesByRegion = (
    regionName: string
): Set<string> | undefined => countriesByRegionMap().get(regionName)

export function calculateZoomToFit(geoFeature: GeoPermissibleObjects): number {
    const bounds = geoPath().projection(geoOrthographic()).bounds(geoFeature)
    const width = bounds[1][0] - bounds[0][0]
    const height = bounds[1][1] - bounds[0][1]
    return Math.min(DEFAULT_GLOBE_SIZE / width, DEFAULT_GLOBE_SIZE / height)
}

export function owidContinentNameToKey(name: string): MapRegionName {
    return name.replace(/ /, "") as MapRegionName
}

let _isOnTheMapCache: Set<string>
export const isOnTheMap = (entityName: EntityName): boolean => {
    // Cache the result
    if (!_isOnTheMapCache)
        _isOnTheMapCache = new Set(
            MapTopology.objects.world.geometries.map((region: any) => region.id)
        )
    return _isOnTheMapCache.has(entityName)
}

export function isPointInEllipse(
    point: { x: number; y: number },
    ellipse: Ellipse
): boolean {
    const dx = point.x - ellipse.cx
    const dy = point.y - ellipse.cy
    return (
        (dx * dx) / (ellipse.rx * ellipse.rx) +
            (dy * dy) / (ellipse.ry * ellipse.ry) <=
        1
    )
}

export function makeEllipseFromPointsForProjection(
    projection: GeoProjection,
    {
        center,
        left,
        top,
    }: {
        center: [number, number]
        left: [number, number]
        top: [number, number]
    }
): Ellipse {
    const projCenter = projection(center)!
    const projLeft = projection(left)!
    const projTop = projection(top)!

    const ellipseRadiusX = Math.abs(projCenter[0] - projLeft[0])
    const ellipseRadiusY = Math.abs(projCenter[1] - projTop[1])

    return {
        cx: projCenter[0],
        cy: projCenter[1],
        rx: ellipseRadiusX,
        ry: ellipseRadiusY,
    }
}

export function getExternalLabelPosition({
    anchorPoint,
    textBounds,
    direction,
    markerLength,
}: {
    anchorPoint: [number, number]
    textBounds: Bounds
    direction: Direction
    markerLength: number
}): [number, number] {
    const [x, y] = anchorPoint
    const l = markerLength
    const w = textBounds.width,
        h = textBounds.height

    switch (direction) {
        case "right":
            return [x + l, y - h / 2]
        case "left":
            return [x - w - l, y - h / 2]
        case "bottom":
            return [x - w / 2, y + l]
        case "top":
            return [x - w / 2, y - h / 2 - l]
    }
}

export function getExternalMarkerStartPosition({
    anchorPoint,
    direction,
    offset = 0,
}: {
    anchorPoint: [number, number]
    direction: Direction
    offset?: number // extend anchor by this amount
}): [number, number] {
    const [x, y] = anchorPoint

    switch (direction) {
        case "right":
            return [x - offset, y]
        case "left":
            return [x + offset, y]
        case "bottom":
            return [x, y - offset]
        case "top":
            return [x, y + offset]
    }
}

export function getExternalMarkerEndPosition({
    textBounds,
    direction,
}: {
    textBounds: Bounds
    direction: Direction
}): [number, number] {
    const { x, y, width, height } = textBounds

    switch (direction) {
        case "right":
            return [x, y + height / 2]
        case "left":
            return [x + width, y + height / 2]
        case "bottom":
            return [x + width / 2, y]
        case "top":
            return [x + width / 2, y + height]
    }
}

export function placeLabelWithinEllipse(
    label: string,
    ellipse: Ellipse
): { placedBounds: Bounds; fontSize: number } | undefined {
    const defaultFontSize = ANNOTATION_FONT_SIZE_DEFAULT
    let textBounds = Bounds.forText(label, { fontSize: defaultFontSize })

    // place label at the given center position
    let placedBounds = textBounds.set({
        x: ellipse.cx - textBounds.width / 2,
        y: ellipse.cy - textBounds.height / 2,
    })

    let labelFitsInsideEllipse = isPointInEllipse(placedBounds.topLeft, ellipse)

    if (labelFitsInsideEllipse)
        return { placedBounds, fontSize: defaultFontSize }

    const step = 1
    for (
        let fontSize = defaultFontSize - step;
        fontSize >= ANNOTATION_FONT_SIZE_MIN;
        fontSize -= step
    ) {
        textBounds = Bounds.forText(label, { fontSize })
        placedBounds = textBounds.set({
            x: ellipse.cx - textBounds.width / 2,
            y: ellipse.cy - textBounds.height / 2,
        })
        labelFitsInsideEllipse = isPointInEllipse(placedBounds.topLeft, ellipse)
        if (labelFitsInsideEllipse) return { placedBounds, fontSize }
    }

    return undefined
}
