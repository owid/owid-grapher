import { Feature, GeoJsonProperties, Polygon } from "geojson"
import { GeoProjection } from "d3-geo"
import { forceSimulation, forceX, forceY, SimulationNodeDatum } from "d3-force"
// @ts-expect-error no types available
import bboxCollide from "./d3-bboxCollide"
import { booleanIntersects } from "@turf/boolean-intersects"
import { Bounds, excludeUndefined } from "@ourworldindata/utils"
import {
    Direction,
    Ellipse,
    RenderFeature,
    ExternalAnnotation,
    Circle,
    EllipseCoords,
    InternalAnnotation,
    GeoFeature,
    ANNOTATION_FONT_SIZE_INTERNAL_DEFAULT,
    ANNOTATION_FONT_SIZE_INTERNAL_MIN,
    ANNOTATION_FONT_SIZE_EXTERNAL_DEFAULT,
    ANNOTATION_FONT_SIZE_EXTERNAL_MAX,
    ANNOTATION_MARKER_LINE_LENGTH_DEFAULT,
    ANNOTATION_MARKER_LINE_LENGTH_MAX,
} from "./MapChartConstants"
import * as R from "remeda"
import { annotationPlacementsById } from "./MapAnnotationPlacements"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import { getGeoFeaturesForGlobe } from "./GeoFeatures"

const MARKER_TEXT_GAP = 2

export function makeInternalAnnotationForFeature({
    feature,
    projection,
    formattedValue,
    color,
    fontSizeScale = 1,
}: {
    feature: RenderFeature
    projection: GeoProjection
    formattedValue: string
    color?: string
    fontSizeScale?: number
}): InternalAnnotation | undefined {
    const placement = annotationPlacementsById.get(feature.id)
    if (!placement || !placement.ellipse) return

    // project ellipse onto the map
    const ellipse = makeEllipseForProjection({
        ellipse: placement.ellipse,
        projection,
        paddingFactor: { x: 0.1 },
    })

    if (!ellipse) return

    // place label at the center of the ellipse (decreases the font size if necessary)
    const placedLabel = placeLabelAtEllipseCenter({
        text: formattedValue,
        ellipse,
        fontSizeScale,
    })

    if (placedLabel)
        return {
            type: "internal",
            id: feature.id,
            feature,
            placedBounds: placedLabel.placedBounds,
            text: formattedValue,
            ellipse,
            fontSize: placedLabel.fontSize,
            color: color ?? GRAPHER_DARK_TEXT,
        }

    return
}

export function makeExternalAnnotationForFeature({
    feature,
    projection,
    formattedValue,
    fontSizeScale = 1,
}: {
    feature: RenderFeature
    projection: GeoProjection
    formattedValue: string
    fontSizeScale?: number
}): ExternalAnnotation | undefined {
    const placement = annotationPlacementsById.get(feature.id)
    if (!placement || !placement.anchorPoint || !placement.direction) return

    const direction = placement.direction
    const anchorPoint = projection(placement.anchorPoint)
    if (!anchorPoint) return

    const fontSize = Math.min(
        ANNOTATION_FONT_SIZE_EXTERNAL_DEFAULT / fontSizeScale,
        ANNOTATION_FONT_SIZE_EXTERNAL_MAX
    )
    const markerLength = Math.min(
        ANNOTATION_MARKER_LINE_LENGTH_DEFAULT / fontSizeScale,
        ANNOTATION_MARKER_LINE_LENGTH_MAX
    )

    // places the label outside of the country borders based on the
    // given anchor point and direction
    let placedBounds = placeExternalLabel({
        text: formattedValue,
        anchorPoint,
        direction,
        fontSize,
        markerLength,
    })

    // make sure the labels of countries like Lesotho and Eswatini that are
    // separated from the ocean by another country are placed in the ocean
    if (placement.bridgeFeatures?.length)
        placedBounds = moveExternalLabelIntoOcean({
            bridgeFeatures: placement.bridgeFeatures,
            placedBounds,
            direction,
            projection,
            step: markerLength / 2,
            maxSteps: 3,
        })

    return {
        type: "external",
        id: feature.id,
        feature,
        text: formattedValue,
        placedBounds,
        anchor: anchorPoint,
        direction,
        fontSize,
        color: GRAPHER_DARK_TEXT,
    }
}

/**
 * Given a list of naively placed external annotations that might overlap,
 * adjust label positions to minimise collisions and drop labels that can't
 * be rendered.
 */
export function repositionAndFilterExternalAnnotations({
    annotations,
    projection,
    backgroundFeatureIdSet, // countries ignored for collision detection
}: {
    annotations: ExternalAnnotation[]
    projection: GeoProjection
    backgroundFeatureIdSet: Set<string>
}): ExternalAnnotation[] {
    const originalAnnotationsById = new Map(
        annotations.map((annotation) => [annotation.id, annotation])
    )

    // re-position label annotations so that they're not overlapping
    const nonOverlappingAnnotations = minimiseLabelCollisions(annotations)

    // the re-positioned label annotations might overlap with other countries
    const filteredAnnotations = nonOverlappingAnnotations.filter(
        (annotation) => {
            // we do these checks only for countries that are proximally close for performance reasons
            let nearbyGeoFeatures = getGeoFeaturesWithinRadius(
                annotation.feature
            )

            // exclude background countries from collision detection,
            // i.e. showing a label on top of a background country is allowed
            if (backgroundFeatureIdSet.size > 0)
                nearbyGeoFeatures = nearbyGeoFeatures.filter(
                    (feature) =>
                        !backgroundFeatureIdSet.has(feature.id as string)
                )

            const nearbyAnnotations = excludeUndefined(
                nearbyGeoFeatures.map((feature) =>
                    originalAnnotationsById.get(feature.id as string)
                )
            )

            return (
                // hide an annotation if the line that connects the annotation
                // with the anchor point crosses through other labels
                !checkAnnotationMarkerCollidesWithSomeLabel({
                    annotation,
                    nearbyAnnotations,
                }) &&
                // hide an annotation if it overlaps with other countries
                !checkAnnotationCollidesWithLandmass({
                    annotation,
                    nearbyGeoFeatures,
                    projection,
                })
            )
        }
    )

    if (filteredAnnotations.length < annotations.length) {
        // reset the filtered annotations to their original position and
        // re-position their labels again
        return minimiseLabelCollisions(
            filteredAnnotations.map((annotation) => {
                const origBounds = originalAnnotationsById.get(
                    annotation.id
                )!.placedBounds
                return { ...annotation, placedBounds: origBounds }
            })
        )
    }

    return filteredAnnotations
}

function placeLabelAtEllipseCenter({
    text,
    ellipse,
    fontSizeScale = 1,
}: {
    text: string
    ellipse: Ellipse
    fontSizeScale?: number
}): { placedBounds: Bounds; fontSize: number } | undefined {
    const defaultFontSize =
        ANNOTATION_FONT_SIZE_INTERNAL_DEFAULT / fontSizeScale

    // place label at the center of the ellipse
    const ellipseCenter = { x: ellipse.cx, y: ellipse.cy }
    let placedBounds = makePlacedBoundsForText({
        text,
        fontSize: defaultFontSize,
        fontWeight: 700,
        position: ellipseCenter,
        center: true,
    })

    // return early if the label fits into the ellipse
    let textFits = checkPointIsInEllipse(placedBounds.topLeft, ellipse)
    if (textFits) return { placedBounds, fontSize: defaultFontSize }

    // decrease the font size to make the label fit into the ellipse
    const step = 1
    for (
        let fontSize = ANNOTATION_FONT_SIZE_INTERNAL_DEFAULT - step;
        fontSize >= ANNOTATION_FONT_SIZE_INTERNAL_MIN;
        fontSize -= step
    ) {
        const scaledFontSize = fontSize / fontSizeScale
        placedBounds = makePlacedBoundsForText({
            text,
            fontSize: scaledFontSize,
            fontWeight: 700,
            position: ellipseCenter,
            center: true,
        })

        textFits = checkPointIsInEllipse(placedBounds.topLeft, ellipse)
        if (textFits) return { placedBounds, fontSize: scaledFontSize }
    }

    // the label text didn't fit into the ellipse
    return undefined
}

function placeExternalLabel({
    text,
    anchorPoint,
    direction,
    fontSize,
    markerLength,
    padding = MARKER_TEXT_GAP,
}: {
    text: string
    anchorPoint: [number, number]
    direction: Direction
    fontSize: number
    markerLength: number
    padding?: number
}): Bounds {
    const textBounds = Bounds.forText(text, { fontSize, fontWeight: 700 })

    const labelPosition = calculateExternalLabelPosition({
        anchorPoint,
        textBounds,
        direction,
        markerLength,
        padding,
    })

    return textBounds.set({ x: labelPosition[0], y: labelPosition[1] })
}

function checkPointIsInEllipse(
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

function makeEllipseForProjection({
    ellipse,
    projection,
    paddingFactor,
}: {
    ellipse: EllipseCoords
    projection: GeoProjection
    paddingFactor?: { x?: number; y?: number }
}): Ellipse | undefined {
    const projCenter = projection([ellipse.cx, ellipse.cy])
    const projLeft = projection([ellipse.left, ellipse.cy])
    const projTop = projection([ellipse.cx, ellipse.top])

    if (!projCenter || !projLeft || !projTop) return undefined

    const rx = Math.abs(projCenter[0] - projLeft[0])
    const ry = Math.abs(projCenter[1] - projTop[1])

    const padX = (paddingFactor?.x ?? 0) * rx
    const padY = (paddingFactor?.y ?? 0) * ry

    return {
        cx: projCenter[0],
        cy: projCenter[1],
        rx: rx - padX,
        ry: ry - padY,
    }
}

/**
 * Calculate the top-left corner of the externally placed label given the
 * top-left corner of the anchor point and a direction
 */
function calculateExternalLabelPosition({
    anchorPoint,
    textBounds,
    direction,
    markerLength,
    padding = MARKER_TEXT_GAP,
}: {
    anchorPoint: [number, number]
    textBounds: Bounds
    direction: Direction
    markerLength: number
    padding?: number
}): [number, number] {
    const [x, y] = anchorPoint
    const w = textBounds.width,
        h = textBounds.height
    const m = markerLength + padding

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
    padding = MARKER_TEXT_GAP,
}: {
    textBounds: Bounds
    direction: Direction
    padding?: number
}): [number, number] {
    const { x, y, width, height } = textBounds

    switch (direction) {
        case "right":
            return [x - padding, y + height / 2]
        case "left":
            return [x + width + padding, y + height / 2]
        case "bottom":
            return [x + width / 2, y - padding]
        case "top":
            return [x + width / 2, y + height + padding]
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

function makePlacedBoundsForText({
    text,
    fontSize,
    fontWeight,
    position,
    center = false,
}: {
    text: string
    fontSize: number
    fontWeight: number
    position: { x: number; y: number }
    center?: boolean
}): Bounds {
    // make bounds for text
    const textBounds = Bounds.forText(text, { fontSize, fontWeight })

    // place bounds at the given position
    const x = center ? position.x - textBounds.width / 2 : position.x
    const y = center ? position.y - textBounds.height / 2 : position.y
    return textBounds.set({ x, y })
}

function moveExternalLabelIntoOcean({
    bridgeFeatures,
    direction,
    placedBounds,
    projection,
    step,
    maxSteps,
}: {
    bridgeFeatures: GeoFeature[]
    direction: Direction
    placedBounds: Bounds
    projection: any
    step: number
    maxSteps: number
}): Bounds {
    // polygon in lon/lat coordinates that represents the annotation label
    let annotationLabel = makePolygonFromBounds(placedBounds, (position) =>
        projection.invert(position)
    )

    let newBounds = placedBounds
    for (let tick = 0; tick < maxSteps; tick++) {
        const intersectsWithSomeFeature = bridgeFeatures.some((bridgeFeature) =>
            booleanIntersects(annotationLabel, bridgeFeature)
        )
        if (!intersectsWithSomeFeature) break

        // update bounds
        newBounds = newBounds.set(
            moveIntoDirectionByStep({
                position: newBounds.topLeft,
                direction,
                step,
            })
        )

        // update label
        annotationLabel = makePolygonFromBounds(newBounds, (position) =>
            projection.invert(position)
        )
    }

    return newBounds
}

function moveIntoDirectionByStep({
    position: { x, y },
    direction,
    step,
}: {
    position: { x: number; y: number }
    direction: Direction
    step: number
}): { x: number; y: number } {
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

const _featuresWithinRadiusCache = new Map<string, GeoFeature[]>()
function getGeoFeaturesWithinRadius(feature: RenderFeature): GeoFeature[] {
    if (_featuresWithinRadiusCache.has(feature.id))
        return _featuresWithinRadiusCache.get(feature.id)!

    const circle = {
        cx: feature.geoCentroid[0],
        cy: feature.geoCentroid[1],
        r: 10,
    }

    const nearbyGeoFeatures = getGeoFeaturesForGlobe()
        .filter(
            (candidate) =>
                candidate.id !== feature.id &&
                checkRectangleOverlapsWithCircle({
                    circle,
                    rectangle: candidate.geoBounds,
                })
        )
        .map((feature) => feature.geo)

    _featuresWithinRadiusCache.set(feature.id, nearbyGeoFeatures)
    return nearbyGeoFeatures
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

interface SimulationNode extends SimulationNodeDatum {
    annotation: ExternalAnnotation
}

function minimiseLabelCollisions(
    annotations: ExternalAnnotation[],
    padding = 1
): ExternalAnnotation[] {
    if (annotations.length < 2) return annotations

    const simulationNodes: SimulationNode[] = annotations.map((annotation) => {
        const { centerX, centerY } = annotation.placedBounds
        const isTopOrBottom =
            annotation.direction === "top" || annotation.direction === "bottom"
        return {
            annotation,
            x: centerX,
            y: centerY,
            // fix the x or y position to make sure the simulation doesn't move
            // a label into its anchor point
            fx: !isTopOrBottom ? centerX : undefined,
            fy: isTopOrBottom ? centerY : undefined,
        }
    })

    // run force simulation that balances two concerns:
    // - keeping the annotation close to its anchor point (x,y forces)
    // - minimising collisions between labels (collide force)
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
            ])
                // weak force since keeping labels close to their anchor point
                // is more important than minimising collisions
                .strength(0.1)
        )
        // simulating very few ticks is good enough since dramatic position
        // changes are not needed in a typical setup
        .tick(10)

    // update the bounds of the original annotations
    const updatedAnnotations = annotations.map((annotation, index) => {
        const node = simulationNodes[index]
        const originalBounds = annotation.placedBounds

        // update placed bounds with the simulated position
        const { x: centerX = 0, y: centerY = 0 } = node
        const placedBounds = originalBounds.set({
            x: centerX - originalBounds.width / 2,
            y: centerY - originalBounds.height / 2,
        })

        return { ...annotation, placedBounds }
    })

    return updatedAnnotations
}

function checkAnnotationCollidesWithLandmass({
    annotation,
    nearbyGeoFeatures,
    projection,
}: {
    annotation: ExternalAnnotation
    nearbyGeoFeatures: GeoFeature[]
    projection: any
}): boolean {
    const annotationLabel = makePolygonFromBounds(
        annotation.placedBounds,
        (position) => projection.invert(position)
    )
    return nearbyGeoFeatures.some((feature) =>
        booleanIntersects(annotationLabel, feature)
    )
}

function checkAnnotationMarkerCollidesWithSomeLabel({
    annotation,
    nearbyAnnotations,
}: {
    annotation: ExternalAnnotation
    nearbyAnnotations: ExternalAnnotation[]
}): boolean {
    // marker line from the anchor point to the label
    const markerStart = annotation.anchor
    const markerEnd = getExternalMarkerEndPosition({
        textBounds: annotation.placedBounds,
        direction: annotation.direction,
    })
    const markerLine = makePolygonForLine(markerStart, markerEnd)

    // check if the marker line crosses through any of the labels
    return nearbyAnnotations.some((nearbyAnnotation) => {
        const nearbyLabel = makePolygonFromBounds(nearbyAnnotation.placedBounds)
        return booleanIntersects(markerLine, nearbyLabel)
    })
}

function makePolygonFromBounds(
    bounds: Bounds,
    transform?: (position: number[]) => number[]
): Feature<Polygon, GeoJsonProperties> {
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
    return {
        type: "Feature",
        properties: {},
        geometry: {
            type: "Polygon",
            coordinates: [corners],
        },
    }
}

function makePolygonForLine(
    start: [number, number],
    end: [number, number],
    lineWidth = 4
): Feature<Polygon, GeoJsonProperties> {
    // Calculate the vector direction of the line
    const dx = end[0] - start[0]
    const dy = end[1] - start[1]
    const lineLength = Math.sqrt(dx * dx + dy * dy)

    // Calculate normalized perpendicular vector
    const perpX = (-dy / lineLength) * (lineWidth / 2)
    const perpY = (dx / lineLength) * (lineWidth / 2)

    // Create four corners of the rectangle
    const corners = [
        [start[0] + perpX, start[1] + perpY],
        [start[0] - perpX, start[1] - perpY],
        [end[0] - perpX, end[1] - perpY],
        [end[0] + perpX, end[1] + perpY],
        [start[0] + perpX, start[1] + perpY], // close the polygon
    ]

    return {
        type: "Feature",
        properties: {},
        geometry: {
            type: "Polygon",
            coordinates: [corners],
        },
    }
}
