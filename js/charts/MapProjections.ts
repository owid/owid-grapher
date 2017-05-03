
import {geoRobinson} from 'd3-geo-projection'
import * as d3 from 'd3'

export default {
	"World": function() {
		var projection = geoRobinson()
		var path = d3.geoPath().projection(projection);
		return {path: path, projection: projection };
	},
	"Africa": function() {
		//empiric
		var k = 3.2;
		var projection = d3.geoConicConformal()
			.rotate([-25, 0])
			.center([0, 0])
			.parallels([30, -20]);
		var path = d3.geoPath().projection(projection);
		return {path: path, projection: projection};
	},
	"N.America": function() {
		//empiric
		var k = 3.2;
		var projection = d3.geoConicConformal()
			.rotate([98, 0])
			.center([0, 38])
			.parallels([29.5, 45.5]);
		var path = d3.geoPath().projection(projection);
		return {path: path, projection: projection};
	},
	"S.America": function() {
		//empiric
		var k = 3.6;
		var projection = d3.geoConicConformal()
			.rotate([68, 0])
			.center([0, -14])
			.parallels([10, -30]);
		var path = d3.geoPath().projection(projection);
		return {path: path, projection: projection};
	},
	"Asia": function() {
		//empiric
		var k = 3.2;
		var projection = d3.geoConicConformal()
			.rotate([-105, 0])
			.center([0, 37])
			.parallels([10, 60]);
		var path = d3.geoPath().projection(projection);
		return {path: path, projection: projection};
	},
	"Europe": function() {
		//empiric
		var k = 1.7;
		var projection = d3.geoConicConformal()
			.rotate([-15, 0])
			.center([0, 55])
			.parallels([60, 40]);
		var path = d3.geoPath().projection(projection);
		return {path: path, projection: projection};
	},
	"Australia": function() {
		//empiric
		var k = 3.2;
		var projection = d3.geoConicConformal()
			.rotate([-135, 0])
			.center([0, -20])
			.parallels([-10, -30]);
		var path = d3.geoPath().projection(projection);
		return {path: path, projection: projection};
	}
};
