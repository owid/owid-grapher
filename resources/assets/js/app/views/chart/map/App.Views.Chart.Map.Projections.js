App.Views.Chart.Map.Projections = {
	"World": function(element) {
		//empiric
		var k = 7.5;
		var projection = d3.geo.eckert3()
			.precision(0.1);
		var path = d3.geo.path().projection(projection);
		return {path: path, projection: projection };
	},
	"Africa": function(element) {
		//empiric
		var k = 3.2;
		var projection = d3.geo.conicConformal()
			.rotate([-25, 0])
			.center([0, 0])
			.parallels([30, -20]);
		var path = d3.geo.path().projection(projection);
		return {path: path, projection: projection};
	},
	"N.America": function(element) {
		//empiric
		var k = 3.2;
		var projection = d3.geo.conicConformal()
			.rotate([98, 0])
			.center([0, 38])
			.parallels([29.5, 45.5]);
		var path = d3.geo.path().projection(projection);
		return {path: path, projection: projection};
	},
	"S.America": function(element) {
		//empiric
		var k = 3.6;
		var projection = d3.geo.conicConformal()
			.rotate([68, 0])
			.center([0, -14])
			.parallels([10, -30]);
		var path = d3.geo.path().projection(projection);
		return {path: path, projection: projection};
	},
	"Asia": function(element) {
		//empiric
		var k = 3.2;
		var projection = d3.geo.conicConformal()
			.rotate([-105, 0])
			.center([0, 37])
			.parallels([10, 60]);
		var path = d3.geo.path().projection(projection);
		return {path: path, projection: projection};
	},
	"Europe": function(element) {
		//empiric
		var k = 1.7;
		var projection = d3.geo.conicConformal()
			.rotate([-15, 0])
			.center([0, 55])
			.parallels([60, 40]);
		var path = d3.geo.path().projection(projection);
		return {path: path, projection: projection};
	},
	"Australia": function(element) {
		//empiric
		var k = 3.2;
		var projection = d3.geo.conicConformal()
			.rotate([-135, 0])
			.center([0, -20])
			.parallels([-10, -30]);
		var path = d3.geo.path().projection(projection);
		return {path: path, projection: projection};
	}
};
module.exports = App.Views.Chart.Map.Projections;