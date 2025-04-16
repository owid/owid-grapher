import { Bounds, excludeUndefined } from "@ourworldindata/utils"
import {
    ANNOTATION_FONT_SIZE_DEFAULT,
    ANNOTATION_FONT_SIZE_MIN,
    Direction,
    Ellipse,
    RenderFeature,
    ExternalAnnotation,
    Circle,
    EllipseCoords,
} from "./MapChartConstants"
import { GeoProjection } from "d3-geo"
import { forceSimulation, forceX, forceY, SimulationNodeDatum } from "d3-force"
import bboxCollide from "./d3-bboxCollide"
import { booleanIntersects as turfBooleanIntersects } from "@turf/boolean-intersects"
import * as R from "remeda"
import { Feature, GeoJsonProperties, LineString, Polygon } from "geojson"

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
        for (let tick = 0; tick < 10; tick++) {
            if (!turfBooleanIntersects(annotationLabel, otherFeature.geo)) break

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
export function getNearbyFeatures({
    feature,
    allFeatures,
    radius = 10, // todo
}: {
    feature: RenderFeature
    allFeatures: RenderFeature[]
    radius?: number
}): RenderFeature[] {
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

export function minimiseLabelCollisions(
    annotations: ExternalAnnotation[],
    padding = 1
): ExternalAnnotation[] {
    interface SimulationNode extends SimulationNodeDatum {
        annotation: ExternalAnnotation
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
            ]).strength(0.1) as any
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

export function checkAnnotationCollidesWithLandmass({
    annotation,
    nearbyFeatures,
    projection,
}: {
    annotation: ExternalAnnotation
    nearbyFeatures: RenderFeature[]
    projection: any
}): boolean {
    const annotationLabel = makeTurfPolygonFromBounds(
        annotation.placedBounds,
        (position) => projection.invert(position)
    )

    return nearbyFeatures.some((feature) =>
        turfBooleanIntersects(annotationLabel, feature.geo)
    )
}

export function checkAnnotationMarkerCollidesWithLabel({
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
    const currLine = makeLineStringFeature(markerStart, markerEnd)

    console.log([markerStart, markerEnd], currLine)

    // check if the annotation's label crosses through any of the labels
    return nearbyAnnotations.some((nearbyAnnotation) => {
        const nearbyLabel = makeTurfPolygonFromBounds(
            nearbyAnnotation.placedBounds
        )
        return turfBooleanIntersects(currLine, nearbyLabel)
    })
}

function makeTurfPolygonFromBounds(
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

function makeLineStringFeature(
    start: [number, number],
    end: [number, number]
): Feature<LineString, GeoJsonProperties> {
    return {
        type: "Feature",
        properties: {},
        geometry: {
            type: "LineString",
            coordinates: [start, end],
        },
    }
}
