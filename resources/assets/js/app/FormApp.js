;( function() {
	
	"use strict";

	var Form = require( "./views/App.Views.Form.js" ),
		ChartModel = require( "./models/App.Models.ChartModel.js" ),
		ChartDataModel = require( "./models/App.Models.ChartDataModel.js" );

	//setup models
	//is new chart or display old chart
	var $chartShowWrapper = $( ".chart-show-wrapper, .chart-edit-wrapper" ),
		chartId = $chartShowWrapper.attr( "data-chart-id" );

	//setup views
	App.View = new Form();

	if( $chartShowWrapper.length && chartId ) {
		
		//showing existing chart
		App.ChartModel = new ChartModel( { id: chartId } );
		App.ChartModel.fetch( {
			success: function( data ) {
				App.View.start();
			},
			error: function( xhr ) {
				console.error( "Error loading chart model", xhr );
			}
		} );
		//find out if it's in cache
		if( !$( ".standalone-chart-viewer" ).length ) {
			//disable caching for viewing within admin
			App.ChartModel.set( "cache", false );
		}
		
	} else {

		//is new chart
		App.ChartModel = new ChartModel();
		App.View.start();

	}

	
	

})();