;( function() {
	
	"use strict";

	//setup models
	//is new chart or display old chart
	var $chartShowWrapper = $( ".chart-show-wrapper, .chart-edit-wrapper" ),
		chartId = $chartShowWrapper.attr( "data-chart-id" );

	//setup views
	App.View = new App.Views.Main();

	if( $chartShowWrapper.length && chartId ) {
		
		//showing existing chart
		App.ChartModel = new App.Models.ChartModel( { id: chartId } );
		App.ChartModel.fetch( {
			success: function( data ) {
				App.View.start();
			},
			error: function( xhr ) {
				console.error( "Error loading chart model", xhr );
			}
		} );
		
	} else {

		//is new chart
		App.ChartModel = new App.Models.ChartModel();
		App.View.start();

	}

	
	

})();