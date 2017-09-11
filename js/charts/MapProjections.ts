declare function require(name:string): any;
import geoRobinson from 'd3-geo-projection/src/robinson'
import * as d3 from 'd3'
import MapProjection from './MapProjection'
import {computed} from 'mobx'

class MapProjections {
	[key: string]: d3.GeoPath<any, any>

	@computed get World() {
		var projection = geoRobinson()
		var path = d3.geoPath().projection(projection)
		return path
	}

	@computed get Africa() {
		//empiric
		var k = 3.2;
		var projection = d3.geoConicConformal()
			.rotate([-25, 0])
			.center([0, 0])
			.parallels([30, -20]);
		var path = d3.geoPath().projection(projection)
		return path
	}

	@computed get NorthAmerica() {
		//empiric
		var k = 3.2;
		var projection = d3.geoConicConformal()
			.rotate([98, 0])
			.center([0, 38])
			.parallels([29.5, 45.5]);
		var path = d3.geoPath().projection(projection)
		return path
	}

	@computed get SouthAmerica() {
		//empiric
		var k = 3.6;
		var projection = d3.geoConicConformal()
			.rotate([68, 0])
			.center([0, -14])
			.parallels([10, -30]);
		var path = d3.geoPath().projection(projection)
		return path
	}

	@computed get Asia() {
		//empiric
		var k = 3.2;
		var projection = d3.geoConicConformal()
			.rotate([-105, 0])
			.center([0, 37])
			.parallels([10, 60]);
		var path = d3.geoPath().projection(projection)
		return path
	}

	@computed get Europe() {
		//empiric
		var k = 1.7;
		var projection = d3.geoConicConformal()
			.rotate([-15, 0])
			.center([0, 55])
			.parallels([60, 40]);
		var path = d3.geoPath().projection(projection)
		return path
	}

	@computed get Australia() {
		//empiric
		var k = 3.2;
		var projection = d3.geoConicConformal()
			.rotate([-135, 0])
			.center([0, -20])
			.parallels([-10, -30]);
		var path = d3.geoPath().projection(projection)
		return path
	}
}

export default new MapProjections()