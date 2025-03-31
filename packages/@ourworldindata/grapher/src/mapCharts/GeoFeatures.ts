import * as topojson from "topojson-client"
import { MapProjectionName } from "@ourworldindata/types"
import { GeoFeature, RenderFeature } from "./MapChartConstants"
import { Bounds, PointVector } from "@ourworldindata/utils"
import { MapProjectionGeos } from "./MapProjections"
import { GeoPathRoundingContext } from "./GeoPathRoundingContext"
import { MapTopology } from "./MapTopology"

// Get the underlying geographical topology elements we're going to display
const GeoFeatures: GeoFeature[] = (
    topojson.feature(
        MapTopology as any,
        MapTopology.objects.world as any
    ) as any
).features

// Get the svg path specification string for every feature
const geoPathCache = new Map<MapProjectionName, string[]>()
const geoPathsFor = (projectionName: MapProjectionName): string[] => {
    if (geoPathCache.has(projectionName))
        return geoPathCache.get(projectionName)!

    // Use this context to round the path coordinates to a set number of decimal places
    const ctx = new GeoPathRoundingContext()
    const projectionGeo = MapProjectionGeos[projectionName].context(ctx)
    const strs = GeoFeatures.map((feature) => {
        ctx.beginPath() // restart the path
        projectionGeo(feature)
        return ctx.result()
    })

    projectionGeo.context(null) // reset the context for future calls

    geoPathCache.set(projectionName, strs)
    return geoPathCache.get(projectionName)!
}

// Get the bounding box for every geographical feature
const geoBoundsCache = new Map<MapProjectionName, Bounds[]>()
export const geoBoundsFor = (projectionName: MapProjectionName): Bounds[] => {
    if (geoBoundsCache.has(projectionName))
        return geoBoundsCache.get(projectionName)!
    const projectionGeo = MapProjectionGeos[projectionName]
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

    geoBoundsCache.set(projectionName, bounds)
    return geoBoundsCache.get(projectionName)!
}

// Bundle GeoFeatures with the calculated info needed to render them
const renderFeaturesCache = new Map<MapProjectionName, RenderFeature[]>()
export const renderFeaturesFor = (
    projectionName: MapProjectionName
): RenderFeature[] => {
    if (renderFeaturesCache.has(projectionName))
        return renderFeaturesCache.get(projectionName)!
    const geoBounds = geoBoundsFor(projectionName)
    const geoPaths = geoPathsFor(projectionName)
    const feats = GeoFeatures.map((geo, index) => ({
        id: geo.id as string,
        geo: geo,
        path: geoPaths[index],
        bounds: geoBounds[index],
        center: geoBounds[index].centerPos,
    }))

    renderFeaturesCache.set(projectionName, feats)
    return renderFeaturesCache.get(projectionName)!
}
