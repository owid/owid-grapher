;(function() {	
	"use strict";
	owid.namespace("chart");
	App.isEditor = false;

	App.loadChart = function(chartConfig) {
		var	ChartModel = App.Models.ChartModel,
			ChartDataModel = App.Models.ChartDataModel;

		App.ChartModel = new ChartModel(chartConfig);
		var chart = owid.chart();

		//find out if it's in cache
		if( !$( ".standalone-charter" ).length ) {
			//disable caching for viewing within admin
			App.ChartModel.set( "cache", false );
		}

		//chosen select
		$( ".chosen-select" ).chosen();		
	};
})();