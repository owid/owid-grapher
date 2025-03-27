import { Quadtree } from "d3-quadtree"
import { getRelativeMouse } from "@ourworldindata/utils"
import { ColorScaleBin } from "../color/ColorScaleBin"
import {
    ChoroplethSeries,
    GEO_FEATURES_CLASSNAME,
    MAP_HOVER_TARGET_RANGE,
    MapEntity,
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

export function hasFocus({
    featureId,
    series,
    focusEntity,
    focusBracket,
}: {
    featureId: string
    series?: ChoroplethSeries
    focusEntity?: MapEntity
    focusBracket?: ColorScaleBin
}): boolean {
    if (focusEntity && focusEntity.id === featureId) return true
    else if (!focusBracket) return false

    if (focusBracket.contains(series?.value)) return true
    else return false
}

export const calculateDistance = (
    p1: [number, number],
    p2: [number, number]
): number => {
    return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2))
}
