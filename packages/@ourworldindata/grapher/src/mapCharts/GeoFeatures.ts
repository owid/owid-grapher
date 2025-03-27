import * as topojson from "topojson-client"
import { MapRegionName } from "@ourworldindata/types"
import {
    GeoFeature,
    GlobeRenderFeature,
    MapRenderFeature,
    RenderFeatureType,
} from "./MapChartConstants"
import { Bounds, PointVector } from "@ourworldindata/utils"
import { MapProjectionGeos } from "./MapProjections"
import { GeoPathRoundingContext } from "./GeoPathRoundingContext"
import { MapTopology } from "./MapTopology"
import { geoCentroid } from "d3-geo"

// Get the underlying geographical topology elements we're going to display
const GeoFeatures: GeoFeature[] = (
    topojson.feature(
        MapTopology as any,
        MapTopology.objects.world as any
    ) as any
).features

// Get the svg path specification string for every feature
const geoPathCache = new Map<MapRegionName, string[]>()
const geoPathsForProjectionOf = (regionName: MapRegionName): string[] => {
    if (geoPathCache.has(regionName)) return geoPathCache.get(regionName)!

    // Use this context to round the path coordinates to a set number of decimal places
    const ctx = new GeoPathRoundingContext()
    const projectionGeo = MapProjectionGeos[regionName].context(ctx)
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
export const geoBoundsForProjectionOf = (
    regionName: MapRegionName
): Bounds[] => {
    if (geoBoundsCache.has(regionName)) return geoBoundsCache.get(regionName)!
    const projectionGeo = MapProjectionGeos[regionName]
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

// Bundle GeoFeatures with the calculated info needed to render them
const renderFeaturesCache = new Map<MapRegionName, MapRenderFeature[]>()
export const renderFeaturesForProjectionOf = (
    regionName: MapRegionName
): MapRenderFeature[] => {
    if (renderFeaturesCache.has(regionName))
        return renderFeaturesCache.get(regionName)!
    const geoBounds = geoBoundsForProjectionOf(regionName)
    const geoPaths = geoPathsForProjectionOf(regionName)
    const feats: MapRenderFeature[] = GeoFeatures.map((geo, index) => ({
        type: RenderFeatureType.Map,
        id: geo.id as string,
        geo: geo,
        path: geoPaths[index],
        bounds: geoBounds[index],
        center: geoBounds[index].centerPos,
    }))

    renderFeaturesCache.set(regionName, feats)
    return renderFeaturesCache.get(regionName)!
}

export const getFeaturesForGlobe = (): GlobeRenderFeature[] => {
    return GeoFeatures.map((geo) => ({
        type: RenderFeatureType.Globe,
        id: geo.id as string,
        geo: geo,
        centroid: geoCentroid(geo),
    }))
}
