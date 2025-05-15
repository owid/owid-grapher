import { Direction, EllipseCoords } from "@ourworldindata/grapher"
import annotationPlacements from "./ManualAnnotationPlacements.json"

interface ManualAnnotationPlacement {
    id: string
    internal?: {
        ellipse: EllipseCoords
    }
    external?: {
        direction: Direction
        anchorPoint: [number, number]
        bridgeCountries?: string[]
    }
}

export const manualAnnotationPlacementsById = new Map<
    string,
    ManualAnnotationPlacement
>(
    annotationPlacements.map((annotation) => [
        annotation.id,
        annotation as ManualAnnotationPlacement,
    ])
)
