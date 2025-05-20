import { Quadtree } from "d3-quadtree"
import { getRelativeMouse, sortBy } from "@ourworldindata/utils"
import {
    GEO_FEATURES_CLASSNAME,
    MAP_HOVER_TARGET_RANGE,
    RenderFeature,
} from "./MapChartConstants"

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

/**
 * Check if a country is visible on the rendered 3d globe from the current
 * viewing angle, without taking into account the zoom level.
 *
 * More specifically, this function checks if the feature's _centroid_ is
 * visible on the globe, i.e. parts of a country could still be visible
 * even if the centroid is not.
 */
export function isPointPlacedOnVisibleHemisphere(
    point: [number, number],
    rotation: [number, number],
    threshold = 0 // 1 = at the exact center, 0 = anywhere on the visible hemisphere
): boolean {
    const toRadians = (degree: number): number => (degree * Math.PI) / 180

    // convert centroid degrees to radians
    const lambda = toRadians(point[0])
    const phi = toRadians(point[1])

    // get current rotation in radians
    const rotationLambda = toRadians(-rotation[0])
    const rotationPhi = toRadians(-rotation[1])

    // calculate the cosine of the angular distance between the feature's
    // center point and the center points of the current view
    const cosDelta =
        Math.sin(phi) * Math.sin(rotationPhi) +
        Math.cos(phi) *
            Math.cos(rotationPhi) *
            Math.cos(lambda - rotationLambda)

    return cosDelta > threshold
}
