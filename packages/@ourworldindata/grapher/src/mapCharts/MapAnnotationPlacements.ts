import annotations from "./MapAnnotationPlacements.json"
import { Direction, EllipseCoords } from "./MapChartConstants"

interface AnnotationPlacement {
    id: string
    ellipse?: EllipseCoords
    direction?: Direction
    anchorPoint?: [number, number]
    bridgeCountries?: string[]
}

export const annotationPlacementsById = new Map<string, AnnotationPlacement>(
    annotations.map((annotation) => [
        annotation.id,
        annotation as AnnotationPlacement,
    ])
)
