;(function() {	
	"use strict";
	owid.namespace("App");

	App.isEditor = false;
	App.loadChart = function(chartConfig) {
		var chart = owid.chart().update({ chartConfig: chartConfig, containerNode: d3.select('body').node() });
	};
})();