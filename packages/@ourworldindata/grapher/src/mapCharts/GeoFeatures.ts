import * as topojson from "topojson-client"
import {
    GeoFeature,
    GlobeRenderFeature,
    MapRenderFeature,
    RenderFeatureType,
} from "./MapChartConstants"
import { Bounds, PointVector } from "@ourworldindata/utils"
import { GeoPathRoundingContext } from "./GeoPathRoundingContext"
import { MapTopology } from "./MapTopology"
import { geoCentroid, geoPath } from "d3-geo"
import { geoRobinson } from "./d3-geo-projection"

// Get the underlying geographical topology elements we're going to display
const GeoFeatures: GeoFeature[] = (
    topojson.feature(
        MapTopology as any,
        MapTopology.objects.world as any
    ) as any
).features

const projection = geoPath().projection(geoRobinson())

// Get the svg path specification string for every feature
const geoPathsForWorldProjection = (): string[] => {
    // Use this context to round the path coordinates to a set number of decimal places
    const ctx = new GeoPathRoundingContext()
    const projectionGeo = projection.context(ctx)
    const strs = GeoFeatures.map((feature) => {
        ctx.beginPath() // restart the path
        projectionGeo(feature)
        return ctx.result()
    })

    projectionGeo.context(null) // reset the context for future calls

    return strs
}

// Get the bounding box for every geographical feature
const geoBoundsForWorldProjection = (): Bounds[] => {
    const bounds = GeoFeatures.map((feature) => {
        const corners = projection.bounds(feature)

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

    return bounds
}

// Bundle GeoFeatures with the calculated info needed to render them
export const getGeoFeaturesForMap = (): MapRenderFeature[] => {
    const geoBounds = geoBoundsForWorldProjection()
    const geoPaths = geoPathsForWorldProjection()
    const feats: MapRenderFeature[] = GeoFeatures.map((geo, index) => ({
        type: RenderFeatureType.Map,
        id: geo.id as string,
        geo: geo,
        path: geoPaths[index],
        bounds: geoBounds[index],
        center: geoBounds[index].centerPos,
    }))
    return feats
}

export const getGeoFeaturesForGlobe = (): GlobeRenderFeature[] => {
    return GeoFeatures.map((geo) => ({
        type: RenderFeatureType.Globe,
        id: geo.id as string,
        geo: geo,
        centroid: geoCentroid(geo),
    }))
}
