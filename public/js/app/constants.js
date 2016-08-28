;(function() {	
	"use strict";

	window.App = window.App || {};

	App.ChartType = {
		LineChart: "LineChart",
		ScatterPlot: "ScatterPlot",
		StackedArea: "StackedArea",
		MultiBar: "MultiBar",
		HorizontalMultiBar: "HorizontalMultiBar",
		DiscreteBar: "DiscreteBar"
	};

	App.LineType = {
		WithDots: 0,
		WithoutDots: 1,
		UnjoinedIfMissing: 2,
		DashedIfMissing: 3
	};

	App.OWID_LOGO = "uploads/26538.png";

	App.AUTHOR_WIDTH = 705;
	App.AUTHOR_HEIGHT = 660;

	//export for iframe
	window.$ = jQuery;

	//export
	window.App = App;
})();

