// @flow
export default {
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

(function() {
	var ε = 1e-6, ε2 = ε * ε, π = Math.PI, halfπ = π / 2, sqrtπ = Math.sqrt(π), radians = π / 180, degrees = 180 / π;
	function sinci(x) {
		return x ? x / Math.sin(x) : 1;
	}
	function sgn(x) {
		return x > 0 ? 1 : x < 0 ? -1 : 0;
	}
	function asin(x) {
		return x > 1 ? halfπ : x < -1 ? -halfπ : Math.asin(x);
	}
	function acos(x) {
		return x > 1 ? 0 : x < -1 ? π : Math.acos(x);
	}
	function asqrt(x) {
		return x > 0 ? Math.sqrt(x) : 0;
	}
	var projection = d3.geo.projection;

	function eckert3(λ, φ) {
		var k = Math.sqrt(π * (4 + π));
		return [ 2 / k * λ * (1 + Math.sqrt(1 - 4 * φ * φ / (π * π))), 4 / k * φ ];
	}
	eckert3.invert = function(x, y) {
		var k = Math.sqrt(π * (4 + π)) / 2;
		return [ x * k / (1 + asqrt(1 - y * y * (4 + π) / (4 * π))), y * k / 2 ];
	};
	(d3.geo.eckert3 = function() {
		return projection(eckert3);
	}).raw = eckert3;

})();

//custom implementation of d3_treshold which uses greaterThan (by using bisectorLeft instead of bisectorRight)
d3.scale.equal_threshold = function() {
  return d3_scale_equal_threshold([0.5], [0, 1]);
};

function d3_scale_equal_threshold(domain, range) {

  function scale(x) {
    if (x <= x) return range[d3.bisectLeft(domain, x)];
  }

  scale.domain = function(_) {
    if (!arguments.length) return domain;
    domain = _;
    return scale;
  };

  scale.range = function(_) {
    if (!arguments.length) return range;
    range = _;
    return scale;
  };

  scale.invertExtent = function(y) {
    y = range.indexOf(y);
    return [domain[y - 1], domain[y]];
  };

  scale.copy = function() {
    return d3_scale_threshold(domain, range);
  };

  return scale;
}