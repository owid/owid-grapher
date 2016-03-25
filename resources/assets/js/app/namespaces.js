;( function() {
	
	"use strict";

	//namespaces
	var App = {};
	App.Views = {};
	App.Views.Chart = {};
	App.Views.Chart.Map = {};
	App.Views.Form = {};
	App.Views.UI = {};
	App.Models = {};
	App.Models.Import = {};
	App.Collections = {};
	App.Utils = {};
	App.Utils.FormHelper = {};
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
		UnjoinedIfMissing: 2		
	}

	//export for iframe
	window.$ = jQuery;

	//export
	window.App = App;

	module.exports = App;

})();

