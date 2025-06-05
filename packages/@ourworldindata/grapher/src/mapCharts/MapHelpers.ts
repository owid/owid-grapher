import { Quadtree } from "d3-quadtree"
import {
    EntityName,
    getAggregates,
    getContinents,
    getIncomeGroups,
    getCountryNamesForRegion,
    getRelativeMouse,
    lazy,
} from "@ourworldindata/utils"
import {
    GEO_FEATURES_CLASSNAME,
    MAP_HOVER_TARGET_RANGE,
    RenderFeature,
    MapRenderFeature,
    RenderFeatureType,
} from "./MapChartConstants"
import { MapTopology } from "./MapTopology.js"
import { MapSelectionArray } from "../selection/MapSelectionArray.js"
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

export const sortFeaturesByInteractionStateAndSize = <
    Feature extends RenderFeature,
>(
    features: Feature[],
    {
        isHovered,
        isSelected,
    }: {
        isHovered: (featureId: string) => boolean
        isSelected: (featureId: string) => boolean
    }
): Feature[] => {
    const preferA = 1 as const
    const preferB = -1 as const

    return R.sort(features, (a, b) => {
        if (isHovered(a.id) && !isHovered(b.id)) return preferA
        if (!isHovered(a.id) && isHovered(b.id)) return preferB

        if (isSelected(a.id) && !isSelected(b.id)) return preferA
        if (!isSelected(a.id) && isSelected(b.id)) return preferB

        return a.geoBounds.area < b.geoBounds.area ? preferA : preferB
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
    const rotationLambda = toRadians(rotation[0])
    const rotationPhi = toRadians(rotation[1])

    // calculate the cosine of the angular distance between the feature's
    // center point and the center points of the current view
    const cosDelta =
        Math.sin(phi) * Math.sin(rotationPhi) +
        Math.cos(phi) *
            Math.cos(rotationPhi) *
            Math.cos(lambda - rotationLambda)

    return cosDelta > threshold
}

export function getForegroundFeatures<Feature extends RenderFeature>(
    features: Feature[],
    selectionArray: MapSelectionArray
): Feature[] {
    // if no regions are selected, then all countries are in the foreground
    if (!selectionArray.hasRegions) return features

    // all countries within the selected regions are in the foreground
    const countrySet = selectionArray.countryNamesForSelectedRegionsSet
    return features.filter((feature) => countrySet.has(feature.id))
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
                    new Set(getCountryNamesForRegion(region)),
                ]
            )
        )
)

export const getCountriesByRegion = (
    regionName: string
): Set<string> | undefined => countriesByRegionMap().get(regionName)

let _isOnTheMapCache: Set<string>
export const isOnTheMap = (entityName: EntityName): boolean => {
    // Cache the result
    if (!_isOnTheMapCache)
        _isOnTheMapCache = new Set(
            MapTopology.objects.world.geometries.map((region: any) => region.id)
        )
    return _isOnTheMapCache.has(entityName)
}

export function isMapRenderFeature(
    feature: RenderFeature
): feature is MapRenderFeature {
    return feature.type === RenderFeatureType.Map
}
