import { Quadtree } from "d3-quadtree"
import {
    geoContains,
    GeoGeometryObjects,
    geoOrthographic,
    geoPath,
    GeoPermissibleObjects,
} from "d3-geo"
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
    PointVector,
    clone,
    excludeUndefined,
    VerticalAlign,
    HorizontalAlign,
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
    GlobeRenderFeature,
    ExternalAnnotation,
    MapRenderFeature,
    RenderFeatureType,
    Circle,
} from "./MapChartConstants"
import { SelectionArray } from "../selection/SelectionArray.js"
import { MapTopology } from "./MapTopology.js"
import {
    forceSimulation,
    forceX,
    forceY,
    GeoProjection,
    SimulationNodeDatum,
} from "d3"
// @ts-expect-error no types available
import { bboxCollide } from "d3-bboxCollide"
// todo: only install/import what's needed (look into helpers)
import * as turf from "@turf/turf"
import { Feature } from "geojson"
import * as R from "remeda"

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

export function checkIsPointInEllipse(
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

export function makeEllipseForProjection({
    ellipse: { center, left, top },
    projection,
}: {
    ellipse: {
        center: [number, number]
        left: [number, number]
        top: [number, number]
    }
    projection: GeoProjection
}): Ellipse | undefined {
    const projCenter = projection(center)
    const projLeft = projection(left)
    const projTop = projection(top)

    if (!projCenter || !projLeft || !projTop) return undefined

    const rx = Math.abs(projCenter[0] - projLeft[0])
    const ry = Math.abs(projCenter[1] - projTop[1])

    return { cx: projCenter[0], cy: projCenter[1], rx, ry }
}

/**
 * Calculate the top-left corner of the externally placed label given the
 * top-left corner of the anchor point and a direction
 */
export function placeLabelExternally({
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
    const w = textBounds.width,
        h = textBounds.height
    const m = markerLength

    switch (direction) {
        case "right":
            return [x + m, y - h / 2]
        case "left":
            return [x - m - w, y - h / 2]
        case "bottom":
            return [x - w / 2, y + m]
        case "top":
            return [x - w / 2, y - h / 2 - m]
        case "leftTop":
            return [x - m - w, y - h / 2 - m / 2 - h]
        case "leftBottom":
            return [x - m - w, y - h / 2 + h + m / 2]
        case "rightTop":
            return [x + m, y - h / 2 - m / 2 - h]
        case "rightBottom":
            return [x + m, y - h / 2 + h + m / 2]
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
        case "leftTop":
            return [x + width, y + height]
        case "leftBottom":
            return [x + width, y]
        case "rightTop":
            return [x, y + height]
        case "rightBottom":
            return [x, y]
    }
}

export function placeLabelAtEllipseCenter({
    text,
    ellipse,
    fontSizeScale = 1,
}: {
    text: string
    ellipse: Ellipse
    fontSizeScale?: number
}): { placedBounds: Bounds; fontSize: number } | undefined {
    const defaultFontSize = ANNOTATION_FONT_SIZE_DEFAULT / fontSizeScale

    // place label at the center of the ellipse
    const ellipseCenter = { x: ellipse.cx, y: ellipse.cy }
    let placedBounds = makePlacedBoundsForText({
        text,
        fontSize: defaultFontSize,
        position: ellipseCenter,
        center: true,
    })

    // return early if the label fits into the ellipse
    let textFits = checkIsPointInEllipse(placedBounds.topLeft, ellipse)
    if (textFits) return { placedBounds, fontSize: defaultFontSize }

    // reduce the font size to make the label fit into the ellipse
    const step = 1
    for (
        let fontSize = ANNOTATION_FONT_SIZE_DEFAULT - step;
        fontSize >= ANNOTATION_FONT_SIZE_MIN;
        fontSize -= step
    ) {
        const scaledFontSize = fontSize / fontSizeScale
        placedBounds = makePlacedBoundsForText({
            text,
            fontSize: scaledFontSize,
            position: ellipseCenter,
            center: true,
        })

        textFits = checkIsPointInEllipse(placedBounds.topLeft, ellipse)
        if (textFits) return { placedBounds, fontSize: scaledFontSize }
    }

    return undefined
}

export function makePlacedBoundsForText({
    text,
    fontSize,
    position,
    center = false,
}: {
    text: string
    fontSize: number
    position: { x: number; y: number }
    center?: boolean
}): Bounds {
    // make bounds for text
    const textBounds = Bounds.forText(text, { fontSize }).set({
        height: fontSize - 1, // todo: apply in bounds?
    })

    // place bounds at the given position
    const x = center ? position.x - textBounds.width / 2 : position.x
    const y = center ? position.y - textBounds.height / 2 : position.y
    return textBounds.set({ x, y })
}

function extendPositionIntoDirectionByStep({
    bounds,
    direction,
    step,
}: {
    bounds: Bounds
    direction: Direction
    step: number
}) {
    const { x, y } = bounds
    switch (direction) {
        case "right":
            return { x: x + step, y }
        case "left":
            return { x: x - step, y }
        case "top":
            return { x, y: y - step }
        case "bottom":
            return { x, y: y + step }
        case "leftTop":
            return { x: x - step, y: y - step }
        case "rightTop":
            return { x: x + step, y: y - step }
        case "leftBottom":
            return { x: x - step, y: y + step }
        case "rightBottom":
            return { x: x + step, y: y + step }
    }
}

export function extendMarkerLineToBridgeGivenFeatures<
    Feature extends RenderFeature,
>({
    bridgeFeatures,
    direction,
    placedBounds,
    projection,
    step,
}: {
    bridgeFeatures: Feature[]
    direction: Direction
    placedBounds: Bounds
    projection: any
    step: number
}): Bounds {
    let annotationLabel = makeTurfPolygonFromBounds(placedBounds, (position) =>
        projection.invert(position)
    )

    let newBounds = placedBounds
    for (const otherFeature of bridgeFeatures) {
        const polygon = makeTurfPolygonForFeature(otherFeature)

        for (let tick = 0; tick < 10; tick++) {
            if (!turf.booleanIntersects(annotationLabel, polygon)) break

            newBounds = newBounds.set(
                extendPositionIntoDirectionByStep({
                    bounds: newBounds,
                    direction,
                    step,
                })
            )

            annotationLabel = makeTurfPolygonFromBounds(newBounds, (position) =>
                projection.invert(position)
            )
        }
    }

    return newBounds
}

// todo: should depend on the direction
// const _countriesWithinRadiusCache = new Map<string, any[]>()
export function getNearbyFeatures<Feature extends RenderFeature>({
    feature,
    allFeatures,
    radius = 10, // todo
}: {
    feature: Feature
    allFeatures: Feature[]
    radius?: number
}): Feature[] {
    const circle = {
        cx: feature.geoCentroid[0],
        cy: feature.geoCentroid[1],
        r: radius,
    }

    const countries = allFeatures.filter(
        (otherFeature) =>
            otherFeature.id !== feature.id &&
            checkRectangleOverlapsWithCircle({
                circle,
                rectangle: otherFeature.geoBounds,
            })
    )
    // _countriesWithinRadiusCache.set(feature.id, countries)
    return countries
}

export function isMapRenderFeature(
    feature: RenderFeature
): feature is MapRenderFeature {
    return feature.type === RenderFeatureType.Map
}

export function isGlobeRenderFeature(
    feature: RenderFeature
): feature is GlobeRenderFeature {
    return feature.type === RenderFeatureType.Globe
}

function checkRectangleOverlapsWithCircle({
    circle,
    rectangle,
}: {
    circle: Circle
    rectangle: Bounds
}): boolean {
    const closestX = R.clamp(circle.cx, {
        min: rectangle.topLeft.x,
        max: rectangle.bottomRight.x,
    })
    const closestY = R.clamp(circle.cy, {
        min: rectangle.topLeft.y,
        max: rectangle.bottomRight.y,
    })

    const dx = circle.cx - closestX
    const dy = circle.cy - closestY

    return dx * dx + dy * dy <= circle.r * circle.r
}

export function minimiseLabelCollisions<Feature extends RenderFeature>(
    annotations: ExternalAnnotation<Feature>[],
    padding = 1
): ExternalAnnotation<Feature>[] {
    interface SimulationNode extends SimulationNodeDatum {
        annotation: ExternalAnnotation<Feature>
    }

    const simulationNodes: SimulationNode[] = annotations.map((annotation) => {
        const { centerX, centerY } = annotation.placedBounds
        const isTopOrBottom =
            annotation.direction === "top" || annotation.direction === "bottom"
        return {
            annotation,
            x: centerX,
            y: centerY,
            fx: !isTopOrBottom ? centerX : undefined,
            fy: isTopOrBottom ? centerY : undefined,
        }
    })

    forceSimulation(simulationNodes)
        .force(
            "x",
            forceX((d: SimulationNode) => d.annotation.placedBounds.centerX)
        )
        .force(
            "y",
            forceY((d: SimulationNode) => d.annotation.placedBounds.centerY)
        )
        .force(
            "collide",
            bboxCollide((d: SimulationNode) => [
                [
                    -d.annotation.placedBounds.width / 2 - padding,
                    -d.annotation.placedBounds.height / 2 - padding,
                ],
                [
                    d.annotation.placedBounds.width / 2 + padding,
                    d.annotation.placedBounds.height / 2 + padding,
                ],
            ]).strength(0.1)
        )
        .tick(10) // todo: default is 300

    return excludeUndefined(
        annotations.map((annotation, index) => {
            const node = simulationNodes[index]
            const originalBounds = annotation.placedBounds
            const { x: centerX = 0, y: centerY = 0 } = node
            const placedBounds = originalBounds.set({
                x: centerX - originalBounds.width / 2,
                y: centerY - originalBounds.height / 2,
            })
            return { ...annotation, placedBounds }
        })
    )
}

export function checkAnnotationCollidesWithLandmass<
    Feature extends RenderFeature,
>({
    annotation,
    nearbyFeatures,
    projection,
}: {
    annotation: ExternalAnnotation<Feature>
    nearbyFeatures: Feature[]
    projection: any
}): boolean {
    const annotationLabel = makeTurfPolygonFromBounds(
        annotation.placedBounds,
        (position) => projection.invert(position)
    )

    return nearbyFeatures.some((feature) => {
        const countryPolygon = makeTurfPolygonForFeature(feature) // todo: buffer?
        if (!countryPolygon) return false
        return turf.booleanIntersects(annotationLabel, countryPolygon)
    })
}

export function checkAnnotationMarkerCollidesWithLabel<
    Feature extends RenderFeature,
>({
    annotation,
    nearbyAnnotations,
}: {
    annotation: ExternalAnnotation<Feature>
    nearbyAnnotations: ExternalAnnotation<Feature>[]
}): boolean {
    // marker line from the anchor point to the label
    const markerStart = annotation.anchor
    const markerEnd = getExternalMarkerEndPosition({
        textBounds: annotation.placedBounds,
        direction: annotation.direction,
    })
    const currLine = turf.lineString([markerStart, markerEnd])

    // check if the annotation's label crosses through any of the labels
    return nearbyAnnotations.some((nearbyAnnotation) => {
        const nearbyLabel = makeTurfPolygonFromBounds(
            nearbyAnnotation.placedBounds
        )
        return turf.booleanIntersects(currLine, nearbyLabel)
    })
}

function makeTurfPolygonFromBounds(
    bounds: Bounds,
    transform?: (position: number[]) => number[]
) {
    let corners = [
        [bounds.topLeft.x, bounds.topLeft.y],
        [bounds.topRight.x, bounds.topRight.y],
        [bounds.bottomRight.x, bounds.bottomRight.y],
        [bounds.bottomLeft.x, bounds.bottomLeft.y],
        [bounds.topLeft.x, bounds.topLeft.y], // close the polygon
    ]
    if (transform) {
        corners = corners.map((position) => transform(position))
    }
    return turf.polygon([corners])
}

// Function to create a Turf.js polygon from a geo feature
// const _turfPolygonCache = new Map<string, any>()
const makeTurfPolygonForFeature = <Feature extends RenderFeature>(
    feature: Feature
): any | null => {
    // if (_turfPolygonCache.has(feature.id))
    // return _turfPolygonCache.get(feature.id)!

    switch (feature.geo.geometry.type) {
        case "Polygon":
            // _turfPolygonCache.set(
            //     feature.id,
            //     turf.polygon(feature.geo.geometry.coordinates)
            // )
            return turf.polygon(feature.geo.geometry.coordinates)
        case "MultiPolygon":
            // _turfPolygonCache.set(
            //     feature.id,
            //     turf.multiPolygon(feature.geo.geometry.coordinates)
            // )
            return turf.multiPolygon(feature.geo.geometry.coordinates)
        default:
            console.warn(
                "Unsupported geometry type:",
                feature.geo.geometry.type
            )
            return null
    }
}
