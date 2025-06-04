import * as topojson from "topojson-client"
import {
    GeoFeature,
    GlobeRenderFeature,
    MapRenderFeature,
    RenderFeatureType,
} from "./MapChartConstants"
import { Bounds, lazy, MapRegionName, PointVector } from "@ourworldindata/utils"
import { GeoPathRoundingContext } from "./GeoPathRoundingContext"
import { MapTopology } from "./MapTopology"
import { geoBounds, geoCentroid, geoPath } from "d3-geo"
import { MAP_PROJECTIONS } from "./MapProjections"

// Get the underlying geographical topology elements we're going to display
export const GeoFeatures: GeoFeature[] = (
    topojson.feature(
        MapTopology as any,
        MapTopology.objects.world as any
    ) as any
).features

export const GeoFeaturesById = new Map(
    GeoFeatures.map((feature) => [feature.id, feature])
)

// Get the svg path specification string for every feature
const geoPathCache = new Map<MapRegionName, string[]>()
const geoPathsFor = (regionName: MapRegionName): string[] => {
    if (geoPathCache.has(regionName)) return geoPathCache.get(regionName)!

    // Use this context to round the path coordinates to a set number of decimal places
    const ctx = new GeoPathRoundingContext()
    const projectionGeo = geoPath()
        .projection(MAP_PROJECTIONS[regionName])
        .context(ctx)
    const strs = GeoFeatures.map((feature) => {
        ctx.beginPath() // restart the path
        projectionGeo(feature)
        return ctx.result()
    })

    projectionGeo.context(null) // reset the context for future calls

    geoPathCache.set(regionName, strs)
    return geoPathCache.get(regionName)!
}

// Get the bounding box for every geographical feature
const geoBoundsCache = new Map<MapRegionName, Bounds[]>()
const geoBoundsFor = (regionName: MapRegionName): Bounds[] => {
    if (geoBoundsCache.has(regionName)) return geoBoundsCache.get(regionName)!

    const projectionGeo = geoPath().projection(MAP_PROJECTIONS[regionName])
    const bounds = GeoFeatures.map((feature) => {
        const corners = projectionGeo.bounds(feature)

        const bounds = Bounds.fromCorners(
            new PointVector(...corners[0]),
            new PointVector(...corners[1])
        )

        // HACK (Mispy): The path generator calculates weird bounds for Fiji (probably it wraps around the map)
        if (feature.id === "Fiji")
            return bounds.set({
                x: bounds.right - bounds.height,
                width: bounds.height,
            })

        return bounds
    })

    geoBoundsCache.set(regionName, bounds)
    return geoBoundsCache.get(regionName)!
}

const geoCentroidsForFeatures = GeoFeatures.map((feature) =>
    geoCentroid(feature.geometry)
)

const geoBoundsForFeatures = GeoFeatures.map((feature) => {
    const corners = geoBounds(feature)
    return Bounds.fromCorners(
        new PointVector(...corners[0]),
        new PointVector(...corners[1])
    )
})

const geoFeaturesForMapCache = new Map<MapRegionName, MapRenderFeature[]>()
export const getGeoFeaturesForMap = (regionName: MapRegionName) => {
    if (geoFeaturesForMapCache.has(regionName))
        return geoFeaturesForMapCache.get(regionName)!

    const projBounds = geoBoundsFor(regionName)
    const projPaths = geoPathsFor(regionName)

    const features = (
        GeoFeatures.map((geo, index) => ({
            type: RenderFeatureType.Map,
            id: geo.id as string,
            geo: geo,
            projBounds: projBounds[index], // projected
            geoBounds: geoBoundsForFeatures[index], // unprojected
            geoCentroid: geoCentroidsForFeatures[index], // unprojected
            path: projPaths[index],
        })) satisfies MapRenderFeature[]
    ).filter((feature) => feature.id !== "Antarctica") // exclude Antarctica since it's distorted and uses up too much space

    geoFeaturesForMapCache.set(regionName, features)
    return geoFeaturesForMapCache.get(regionName)!
}

export const getGeoFeaturesForGlobe = lazy((): GlobeRenderFeature[] => {
    return GeoFeatures.map((geo, index) => {
        const corners = geoBounds(geo)
        const bounds = Bounds.fromCorners(
            new PointVector(...corners[0]),
            new PointVector(...corners[1])
        )
        return {
            type: RenderFeatureType.Globe,
            id: geo.id as string,
            geo: geo,
            geoCentroid: geoCentroidsForFeatures[index],
            geoBounds: bounds,
        }
    }) satisfies GlobeRenderFeature[]
})
