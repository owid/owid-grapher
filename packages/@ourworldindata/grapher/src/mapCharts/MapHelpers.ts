import { Quadtree } from "d3-quadtree"
import {
    geoContains,
    GeoGeometryObjects,
    geoOrthographic,
    geoPath,
    GeoPermissibleObjects,
} from "d3-geo"
import * as topojson from "topojson-client"
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
    clamp,
    zip,
    excludeUndefined,
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
    ANNOTATION_FONT_SIZE_MAX,
    ExternalAnnotation,
    MapRenderFeature,
    RenderFeatureType,
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
import { GeoFeatures } from "./GeoFeatures"
// @ts-expect-error no types available
import { bboxCollide } from "d3-bboxCollide"
// todo: only install/import what's needed (look into helpers)
import * as turf from "@turf/turf"
import { Feature } from "geojson"

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
    {
        center,
        left,
        top,
    }: {
        center: [number, number]
        left: [number, number]
        top: [number, number]
    },
    projection: GeoProjection
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
        // todo
        case "leftTop":
            return [x - w - l, y - h / 2 - l]
        case "leftBottom":
            return [x - w - l, y + l]
        case "rightTop":
            return [x + l, y - h / 2 - l]
        case "rightBottom":
            return [x + l, y + l]
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
    return [x, y]

    // switch (direction) {
    //     case "right":
    //         return [x - offset, y]
    //     case "left":
    //         return [x + offset, y]
    //     case "bottom":
    //         return [x, y - offset]
    //     case "top":
    //         return [x, y + offset]
    //     case "leftTop":
    //         return [x - offset, y - h / 2 - l]
    //     case "leftBottom":
    //         return [x, y + h / 2 + l]
    //     case "rightTop":
    //         return [x + l, y - h / 2 - l]
    //     case "rightBottom":
    //         return [x + l, y + h / 2 + l]
    // }
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

export function placeLabelWithinEllipse(
    label: string,
    ellipse: Ellipse,
    { fontSizeScale }: { fontSizeScale: number }
): { placedBounds: Bounds; fontSize: number } | undefined {
    const defaultFontSize = Math.min(
        ANNOTATION_FONT_SIZE_DEFAULT / fontSizeScale,
        ANNOTATION_FONT_SIZE_MAX
    )
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
        let fontSize = ANNOTATION_FONT_SIZE_DEFAULT - step;
        fontSize >= ANNOTATION_FONT_SIZE_MIN;
        fontSize -= step
    ) {
        const actualFontSize = Math.min(
            fontSize / fontSizeScale,
            ANNOTATION_FONT_SIZE_MAX
        )
        textBounds = Bounds.forText(label, {
            fontSize: actualFontSize,
        })
        placedBounds = textBounds.set({
            x: ellipse.cx - textBounds.width / 2,
            y: ellipse.cy - textBounds.height / 2,
        })
        labelFitsInsideEllipse = isPointInEllipse(placedBounds.topLeft, ellipse)
        if (labelFitsInsideEllipse)
            return { placedBounds, fontSize: actualFontSize }
    }

    return undefined
}

function getCornersForDirection({
    placedBounds,
    direction,
}: {
    placedBounds: Bounds
    direction: Direction
}): PointVector[] {
    return [
        placedBounds.topLeft,
        placedBounds.topRight,
        placedBounds.bottomRight,
        placedBounds.bottomLeft,
    ]
    // switch (direction) {
    //     case "right":
    //         return [placedBounds.topLeft, placedBounds.bottomLeft]
    //     case "left":
    //         return [placedBounds.topRight, placedBounds.bottomRight]
    //     case "top":
    //         return [placedBounds.bottomLeft, placedBounds.bottomRight]
    //     case "bottom":
    //         return [placedBounds.topLeft, placedBounds.topRight]
    //     // todo
    //     case "leftTop":
    //         return [placedBounds.bottomRight, placedBounds.bottomLeft]
    //     case "leftBottom":
    //         return [placedBounds.topRight, placedBounds.topLeft]
    //     case "rightTop":
    //         return [placedBounds.bottomLeft, placedBounds.bottomRight]
    //     case "rightBottom":
    //         return [placedBounds.topLeft, placedBounds.topRight]
    // }
}

// makes sure Lesotho or Eswatini are placed in the ocean and not inside South Africa
export function placeLabelInOcean<Feature extends RenderFeature>({
    features,
    direction,
    placedBounds,
    projection,
    step,
}: {
    features: Feature[]
    direction: Direction
    placedBounds: Bounds
    projection: any
    step: number
}): Bounds {
    let corners = getCornersForDirection({ placedBounds, direction }).map(
        (corner) => projection.invert([corner.x, corner.y])
    )

    let maxRecursionDepth = 10

    let newBounds = placedBounds
    for (const feature of features) {
        for (let i = 0; i < corners.length; i++) {
            let recursionDepth = 0
            while (
                // todo: could use turf here
                geoContains(feature.geo.geometry, corners[i]) &&
                recursionDepth <= maxRecursionDepth
            ) {
                recursionDepth += 1

                if (direction === "right") {
                    newBounds = newBounds.set({
                        x: newBounds.x + step,
                        y: newBounds.y,
                    })
                } else if (direction === "left") {
                    newBounds = newBounds.set({
                        x: newBounds.x - step,
                        y: newBounds.y,
                    })
                } else if (direction === "top") {
                    newBounds = newBounds.set({
                        x: newBounds.x,
                        y: newBounds.y - step,
                    })
                } else if (direction === "bottom") {
                    newBounds = newBounds.set({
                        x: newBounds.x,
                        y: newBounds.y + step,
                    })
                } else if (direction === "leftTop") {
                    newBounds = newBounds.set({
                        x: newBounds.x - step,
                        y: newBounds.y - step,
                    })
                } else if (direction === "rightTop") {
                    newBounds = newBounds.set({
                        x: newBounds.x + step,
                        y: newBounds.y - step,
                    })
                } else if (direction === "leftBottom") {
                    newBounds = newBounds.set({
                        x: newBounds.x - step,
                        y: newBounds.y + step,
                    })
                } else if (direction === "rightBottom") {
                    newBounds = newBounds.set({
                        x: newBounds.x + step,
                        y: newBounds.y + step,
                    })
                }

                corners = getCornersForDirection({
                    placedBounds: newBounds,
                    direction,
                }).map((corner) => projection.invert([corner.x, corner.y]))
            }
        }
    }

    return newBounds
}

function isPointInCircle(
    point: { x: number; y: number },
    circle: { cx: number; cy: number; r: number }
): boolean {
    const dx = point.x - circle.cx
    const dy = point.y - circle.cy
    return dx * dx + dy * dy <= circle.r * circle.r
}

// todo: should depend on the directio
const _countriesWithinRadiusCache = new Map<string, any[]>()
export function getCountriesWithinRadius<Feature extends RenderFeature>(
    feature: Feature,
    allFeatures: Feature[],
    projection: any
): Feature[] {
    // if (_countriesWithinRadiusCache.has(feature.id))
    //     return _countriesWithinRadiusCache.get(feature.id)!
    const radius = 10
    const center = isMapRenderFeature(feature)
        ? projection.invert([feature.center.x, feature.center.y])
        : isGlobeRenderFeature(feature)
          ? feature.centroid
          : [0, 0]
    const circle = {
        cx: center[0],
        cy: center[1],
        r: radius,
    }
    const countries = allFeatures
        .filter((f) => {
            const bounds = isMapRenderFeature(feature)
                ? [
                      projection.invert([
                          f.bounds.topLeft.x,
                          f.bounds.topLeft.y,
                      ]),
                      projection.invert([
                          f.bounds.bottomRight.x,
                          f.bounds.bottomRight.y,
                      ]),
                  ]
                : [
                      [f.bounds.topLeft.x, f.bounds.topLeft.y],
                      [f.bounds.bottomRight.x, f.bounds.bottomRight.y],
                  ]
            return circleRectangleOverlap(circle, {
                topLeft: { x: bounds[0][0], y: bounds[0][1] },
                bottomRight: { x: bounds[1][0], y: bounds[1][1] },
            })
        })
        .filter((f) => f.id !== feature.id)
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

export function circleRectangleOverlap(
    circle: { cx: number; cy: number; r: number },
    rect: {
        topLeft: { x: number; y: number }
        bottomRight: { x: number; y: number }
    }
): boolean {
    const closestX = clamp(circle.cx, rect.topLeft.x, rect.bottomRight.x)
    const closestY = clamp(circle.cy, rect.topLeft.y, rect.bottomRight.y)

    const dx = circle.cx - closestX
    const dy = circle.cy - closestY

    return dx * dx + dy * dy <= circle.r * circle.r
}

export function adjustLabelPositionsToMinimiseLabelCollisions<
    Feature extends RenderFeature,
>(annotations: ExternalAnnotation<Feature>[]): ExternalAnnotation<Feature>[] {
    interface SimulationNode extends SimulationNodeDatum {
        id: string
        bounds: Bounds
    }

    const nodes: SimulationNode[] = annotations.map((a) => ({
        id: a.id,
        bounds: a.bounds,
        x: a.bounds.centerX,
        y: a.bounds.centerY,
        fx:
            a.direction === "right" ||
            a.direction === "left" ||
            a.direction === "rightBottom" ||
            a.direction === "leftBottom" ||
            a.direction === "rightTop" ||
            a.direction === "leftTop"
                ? a.bounds.centerX
                : undefined,
        fy:
            a.direction === "top" || a.direction === "bottom"
                ? a.bounds.centerY
                : undefined,
    }))

    forceSimulation(nodes)
        .force(
            "x",
            forceX((d: SimulationNode) => d.bounds.centerX)
        )
        .force(
            "y",
            forceY((d: SimulationNode) => d.bounds.centerY)
        )
        .force(
            "collide",
            bboxCollide((d: SimulationNode) => [
                [-d.bounds.width / 2 - 1, -d.bounds.height / 2 - 1],
                [d.bounds.width / 2 + 1, d.bounds.height / 2 + 1],
            ])
        )
        .tick(100) // todo: default is 300

    return excludeUndefined(
        zip(annotations, nodes).map(([annotation, node]) => {
            if (!annotation || !node) return undefined
            const originalBounds = annotation.bounds
            const { x: centerX = 0, y: centerY = 0 } = node
            const bounds = originalBounds.set({
                x: centerX - originalBounds.width / 2,
                y: centerY - originalBounds.height / 2,
            })
            return { ...annotation, bounds }
        })
    )
}

export function hideLabelsCollidingWithLandMass<Feature extends RenderFeature>(
    annotations: ExternalAnnotation<Feature>[],
    allFeatures: Feature[],
    projection: any
) {
    const annotationsById = new Map(
        annotations.map((annotation) => [annotation.id, annotation])
    )
    return annotations.filter((annotation) => {
        const nearbyFeatures = getCountriesWithinRadius(
            annotation.feature,
            allFeatures,
            projection
        )
        console.log("nearby features", annotation.id, nearbyFeatures)

        const nearbyAnnotations = excludeUndefined(
            nearbyFeatures.map((f) => annotationsById.get(f.id))
        )

        const projCorners = [
            [annotation.bounds.topLeft.x, annotation.bounds.topLeft.y],
            [annotation.bounds.topRight.x, annotation.bounds.topRight.y],
            [annotation.bounds.bottomRight.x, annotation.bounds.bottomRight.y],
            [annotation.bounds.bottomLeft.x, annotation.bounds.bottomLeft.y],
            [annotation.bounds.topLeft.x, annotation.bounds.topLeft.y],
        ]
        const unprojCorners = projCorners.map((corner) =>
            projection.invert(corner)
        )
        const annotationPolygon = turf.polygon([unprojCorners])
        const projAnnotationPolygon = turf.polygon([projCorners])

        const currLine = turf.lineString([
            getExternalMarkerStartPosition({
                anchorPoint: annotation.anchor,
                direction: annotation.direction,
            }),
            getExternalMarkerEndPosition({
                textBounds: annotation.bounds,
                direction: annotation.direction,
            }),
        ])

        // check if the annotation's label crosses through any of the labels
        const hasOverlapWithSomeLabel = nearbyAnnotations.some(
            (nearbyAnnotation) => {
                const projCorners = [
                    [
                        nearbyAnnotation.bounds.topLeft.x,
                        nearbyAnnotation.bounds.topLeft.y,
                    ],
                    [
                        nearbyAnnotation.bounds.topRight.x,
                        nearbyAnnotation.bounds.topRight.y,
                    ],
                    [
                        nearbyAnnotation.bounds.bottomRight.x,
                        nearbyAnnotation.bounds.bottomRight.y,
                    ],
                    [
                        nearbyAnnotation.bounds.bottomLeft.x,
                        nearbyAnnotation.bounds.bottomLeft.y,
                    ],
                    [
                        nearbyAnnotation.bounds.topLeft.x,
                        nearbyAnnotation.bounds.topLeft.y,
                    ],
                ]
                const nearbyLabel = turf.polygon([projCorners])
                const hasOverlap = turf.booleanIntersects(currLine, nearbyLabel)

                return hasOverlap
            }
        )

        const hasOverlapWithSomeFeature = nearbyFeatures.some((feature) => {
            // const countryPolygon = turf.buffer(createTurfPolygon(feature), 140)
            const countryPolygon = createTurfPolygon(feature)
            // console.log("turf here", countryPolygon)
            if (!countryPolygon) return false
            const hasOverlap = turf.booleanIntersects(
                annotationPolygon,
                countryPolygon
            )
            // if (hasOverlap)
            console.log("has overlap?", annotation.id, feature.id, hasOverlap)

            return hasOverlap
        })

        if (hasOverlapWithSomeFeature)
            console.log("has overlap label", annotation.id)

        // return !hasOverlapWithSomeLabel
        return !hasOverlapWithSomeLabel && !hasOverlapWithSomeFeature
    })
}

// Function to create a Turf.js polygon from a geo feature
const _turfPolygonCache = new Map<string, any>()
const createTurfPolygon = <Feature extends RenderFeature>(
    feature: Feature
): any | null => {
    if (_turfPolygonCache.has(feature.id))
        return _turfPolygonCache.get(feature.id)!

    switch (feature.geo.geometry.type) {
        case "Polygon":
            _turfPolygonCache.set(
                feature.id,
                turf.polygon(feature.geo.geometry.coordinates)
            )
            return _turfPolygonCache.get(feature.id)!
        case "MultiPolygon":
            _turfPolygonCache.set(
                feature.id,
                turf.multiPolygon(feature.geo.geometry.coordinates)
            )
            return _turfPolygonCache.get(feature.id)!
        default:
            console.warn(
                "Unsupported geometry type:",
                feature.geo.geometry.type
            )
            return null
    }
}
