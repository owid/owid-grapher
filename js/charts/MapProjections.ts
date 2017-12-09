import { geoPath, GeoPath, geoConicConformal } from 'd3-geo'
import { computed } from 'mobx'
const { geoRobinson } = require('d3-geo-projection')

class MapProjections {
    [key: string]: GeoPath<any, any>

    @computed get World(): GeoPath<any, any> {
        const projection = geoRobinson()
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
        //empiric
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

    @computed get Asia(): GeoPath<any, any> {
        //empiric
        const projection = geoConicConformal()
            .rotate([-105, 0])
            .center([0, 37])
            .parallels([10, 60])
        const path = geoPath().projection(projection)
        return path
    }

    @computed get Europe(): GeoPath<any, any> {
        //empiric
        const projection = geoConicConformal()
            .rotate([-15, 0])
            .center([0, 55])
            .parallels([60, 40])
        const path = geoPath().projection(projection)
        return path
    }

    @computed get Australia(): GeoPath<any, any> {
        //empiric
        const projection = geoConicConformal()
            .rotate([-135, 0])
            .center([0, -20])
            .parallels([-10, -30])
        const path = geoPath().projection(projection)
        return path
    }
}

export default new MapProjections()
