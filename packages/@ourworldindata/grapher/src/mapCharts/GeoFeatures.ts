import * as topojson from "topojson-client"
import {
    GeoFeature,
    GlobeRenderFeature,
    MapRenderFeature,
    RenderFeatureType,
} from "./MapChartConstants"
import { Bounds, lazy, PointVector } from "@ourworldindata/utils"
import { GeoPathRoundingContext } from "./GeoPathRoundingContext"
import { MapTopology } from "./MapTopology"
import { geoBounds, geoCentroid, geoPath } from "d3-geo"
import { geoRobinson } from "./d3-geo-projection"

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

// Bundle GeoFeatures with the calculated info needed to render them
export const getGeoFeaturesForMap = lazy((): MapRenderFeature[] => {
    const projBounds = geoBoundsForWorldProjection()
    const projPaths = geoPathsForWorldProjection()
    return GeoFeatures.map((geo, index) => ({
        type: RenderFeatureType.Map,
        id: geo.id as string,
        geo: geo,
        projBounds: projBounds[index], // projected
        geoBounds: geoBoundsForFeatures[index], // unprojected
        geoCentroid: geoCentroidsForFeatures[index], // unprojected
        path: projPaths[index],
    })) satisfies MapRenderFeature[]
})

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
