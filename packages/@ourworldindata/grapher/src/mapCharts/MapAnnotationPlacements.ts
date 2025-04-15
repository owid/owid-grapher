import annotations from "./MapAnnotationPlacements.json"
import { Direction } from "./MapChartConstants"

interface AnnotationPlacement {
    id: string
    ellipse: {
        center: [number, number]
        left: [number, number]
        top: [number, number]
    }
    external?: {
        direction: Direction
        anchorPoint: [number, number]
        bridgeCountries?: string[]
    }
}

export const annotationPlacementsById = new Map<string, AnnotationPlacement>(
    annotations.map((annotation) => [
        annotation.id,
        annotation as AnnotationPlacement,
    ])
)
