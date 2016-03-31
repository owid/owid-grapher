;( function() {
	
	"use strict";

	var App = require( "./namespaces.js" ),
		Chart = require( "./views/App.Views.Chart.js" ),
		ChartModel = require( "./models/App.Models.ChartModel.js" ),
		ChartDataModel = require( "./models/App.Models.ChartDataModel.js" );

	//setup models
	//is new chart or display old chart
	var $chartShowWrapper = $( ".chart-show-wrapper, .chart-edit-wrapper" ),
		chartId = $chartShowWrapper.attr( "data-chart-id" );

	//setup views
	App.View = new Chart();

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

		// Update the url if selected countries changes
		// Lives in ChartApp because we don't want it to happen in the editor
		// - mispy
		App.ChartModel.on("change:selected-countries", function() {
			var selectedCountries = App.ChartModel.get("selected-countries"),
				entityCodes = [];

			if (!App.DataModel) return;

			App.DataModel.ready(function(variableData) {
				// Sort them by name so the order in the url matches the legend
				var sortedCountries = _.sortBy(selectedCountries, function(entity) {
					return entity.name;
				});

				var entityCodes = [];
				_.each(sortedCountries, function(entity) {
					var foundEntity = variableData.entityKey[entity.id];
					if (!foundEntity) return;
					entityCodes.push(foundEntity.code || foundEntity.name);
				});

				owid.setQueryVariable("country", entityCodes.join("+"));
			});
		});

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

	//chosen select
	$( ".chosen-select" ).chosen();

})();