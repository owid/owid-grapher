import { GeoFeaturesById } from "./GeoFeatures"
import annotations from "./MapAnnotationPlacements.json"
import { Direction, EllipseCoords, GeoFeature } from "./MapChartConstants"

interface RawAnnotationPlacement {
    id: string
    ellipse?: EllipseCoords
    direction?: Direction
    anchorPoint?: [number, number]
    bridgeCountries?: string[]
}

interface EnrichedAnnotationPlacement
    extends Omit<RawAnnotationPlacement, "bridgeCountries"> {
    bridgeFeatures?: GeoFeature[]
}

export const annotationPlacementsById = new Map<
    string,
    EnrichedAnnotationPlacement
>(
    annotations.map((annotation) => {
        const enrichedAnnotation = {
            ...annotation,
            bridgeFeatures: annotation.bridgeCountries?.map((name) =>
                GeoFeaturesById.get(name)
            ),
        } as EnrichedAnnotationPlacement
        return [annotation.id, enrichedAnnotation]
    })
)
