import {
    geoAzimuthalEqualArea,
    geoConicConformal,
    geoPath,
    GeoPath,
    GeoProjection
} from "d3-geo"
import { computed } from "mobx"
const { geoRobinson, geoPatterson } = require("d3-geo-projection")

class MapProjectionsKlass {
    [key: string]: GeoPath<any, any>

    @computed get World(): GeoPath<any, any> {
        const projection = geoRobinson() as GeoProjection
        const path = geoPath().projection(projection)
        return path
    }

    @computed get Africa(): GeoPath<any, any> {
        //empiric
        const projection = geoConicConformal()
            .rotate([-25, 0])
            .center([0, 0])
            .parallels([30, -20])
        const path = geoPath().projection(projection)
        return path
    }

    @computed get NorthAmerica(): GeoPath<any, any> {
        const projection = geoConicConformal()
            .rotate([98, 0])
            .center([0, 38])
            .parallels([29.5, 45.5])
        const path = geoPath().projection(projection)
        return path
    }

    @computed get SouthAmerica(): GeoPath<any, any> {
        //empiric
        const projection = geoConicConformal()
            .rotate([68, 0])
            .center([0, -14])
            .parallels([10, -30])
        const path = geoPath().projection(projection)
        return path
    }
    // From http://bl.ocks.org/dhoboy/ff8448ace9d5d567390a
    @computed get Asia(): GeoPath<any, any> {
        const projection = geoPatterson()
            .center([58, 54])
            .scale(150)
            .translate([0, 0])
            .precision(0.1)
        const path = geoPath().projection(projection)
        return path
    }

    // From http://bl.ocks.org/espinielli/10587361
    @computed get Europe(): GeoPath<any, any> {
        const projection = geoAzimuthalEqualArea()
            .scale(200)
            .translate([262, 1187])
            .clipAngle(180 - 1e-3)
            .precision(1)
        const path = geoPath().projection(projection)
        return path
        //empiric
        /*const projection = geoConicConformal()
            .rotate([-15, 0])
            .center([0, 55])
            .parallels([60, 40])
        const path = geoPath().projection(projection)
        return path*/
    }

    @computed get Oceania(): GeoPath<any, any> {
        const projection = geoConicConformal()
            .rotate([-135, 0])
            .center([0, -20])
            .parallels([-10, -30])
        const path = geoPath().projection(projection)
        return path
    }
}

const MapProjections = new MapProjectionsKlass()
export { MapProjections }
