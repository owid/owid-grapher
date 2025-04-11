import { Quadtree } from "d3-quadtree"
import { geoOrthographic, geoPath, GeoPermissibleObjects } from "d3-geo"
import {
    EntityName,
    getAggregates,
    getContinents,
    getIncomeGroups,
    getMemberNamesOfRegion,
    getRelativeMouse,
    lazy,
    MapRegionName,
    sortBy,
} from "@ourworldindata/utils"
import {
    DEFAULT_GLOBE_SIZE,
    GEO_FEATURES_CLASSNAME,
    MAP_HOVER_TARGET_RANGE,
    RenderFeature,
} from "./MapChartConstants"
import { SelectionArray } from "../selection/SelectionArray.js"
import { MapTopology } from "./MapTopology.js"

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
