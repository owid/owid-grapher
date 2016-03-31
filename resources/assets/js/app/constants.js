;(function() {	
	"use strict";

	window.App = window.App || {};

	App.ChartType = {
		LineChart: 1,
		ScatterPlot: 2,
		StackedArea: 3,
		MultiBar: 4,
		HorizontalMultiBar: 5,
		DiscreteBar: 6
	};

	App.LineType = {
		WithDots: 0,
		WithoutDots: 1,
		UnjoinedIfMissing: 2,
		DashedIfMissing: 3
	}

	//export for iframe
	window.$ = jQuery;

	//export
	window.App = App;
})();

