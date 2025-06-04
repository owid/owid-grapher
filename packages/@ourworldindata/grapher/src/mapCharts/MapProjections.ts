import { geoConicConformal, geoAzimuthalEqualArea, GeoProjection } from "d3-geo"
import { geoRobinson, geoPatterson } from "./d3-geo-projection.js"
import { MapRegionName } from "@ourworldindata/types"

export const MAP_PROJECTIONS: Record<MapRegionName, GeoProjection> = {
    World: geoRobinson(),

    Africa: geoConicConformal()
        .rotate([-25, 0])
        .center([0, 0])
        .parallels([30, -20]),

    NorthAmerica: geoConicConformal()
        .rotate([98, 0])
        .center([0, 38])
        .parallels([29.5, 45.5]),

    SouthAmerica: geoConicConformal()
        .rotate([68, 0])
        .center([0, -14])
        .parallels([10, -30]),

    // From http://bl.ocks.org/dhoboy/ff8448ace9d5d567390a
    Asia: geoPatterson()
        .center([58, 54])
        .scale(150)
        .translate([0, 0])
        .precision(0.1),

    // From http://bl.ocks.org/espinielli/10587361
    Europe: geoAzimuthalEqualArea()
        .scale(200)
        .translate([262, 1187])
        .clipAngle(180 - 1e-3)
        .precision(1),

    Oceania: geoConicConformal()
        .rotate([-135, 0])
        .center([0, -20])
        .parallels([-10, -30]),
} as const
