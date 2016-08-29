;(function() {	
	"use strict";
	owid.namespace("App.ChartView");
	App.isEditor = false;

	App.loadChart = function(chartConfig) {
		var	ChartView = App.Views.ChartView,
			ChartModel = App.Models.ChartModel,
			ChartDataModel = App.Models.ChartDataModel;

		var $chart = $("#chart"),
			chartId = $chart.attr("data-chart-id");

		if (!$chart.length || !chartId)
			return; // No chart to show here

		App.ChartModel = new ChartModel(chartConfig);
		App.ChartView = owid.chart();

		//find out if it's in cache
		if( !$( ".standalone-charter" ).length ) {
			//disable caching for viewing within admin
			App.ChartModel.set( "cache", false );
		}

		//chosen select
		$( ".chosen-select" ).chosen();		
	};
})();