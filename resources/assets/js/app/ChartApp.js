;$(document).ready(function() {	
	"use strict";

	var	ChartView = App.Views.ChartView,
		ChartModel = App.Models.ChartModel,
		ChartDataModel = App.Models.ChartDataModel;

	var $chartShowWrapper = $(".chart-show-wrapper, .chart-edit-wrapper"),
		chartId = $chartShowWrapper.attr("data-chart-id");

	if (!$chartShowWrapper.length || !chartId)
		return; // No chart to show here

	App.ChartModel = new ChartModel({ id: chartId });
	App.ChartModel.fetch({
		success: function(data) {
			App.ChartView = new App.Views.ChartView();
		},
		error: function(xhr) {
			console.error("Error loading chart model", xhr);
		}
	});

	//find out if it's in cache
	if( !$( ".standalone-chart-viewer" ).length ) {
		//disable caching for viewing within admin
		App.ChartModel.set( "cache", false );
	}

	//chosen select
	$( ".chosen-select" ).chosen();
});