;( function() {
	
	"use strict";

	var App = require( "./../../../../namespaces.js" );

	App.Views.Chart.Map.ButtonsControl = Backbone.View.extend({

		el: "#map-chart-tab .map-timeline-controls .buttons-control",
		events: {},

		initialize: function( options ) {

			this.dispatcher = options.dispatcher;
			this.$buttonsWrapper = this.$el.find( ".buttons-wrapper" );

			App.ChartModel.on( "change", this.onChartModelChange, this );
			App.ChartModel.on( "change-map", this.onChartModelChange, this );

			return;
		},

		render: function() {
			var mapConfig = App.ChartModel.get( "map-config" ),
				targetYear = mapConfig.targetYear,
				years = owid.timeRangesToYears(mapConfig.timeRanges, mapConfig.minYear, mapConfig.maxYear);

			//create all necessary buttons
			this.$buttonsWrapper.empty();

			var htmlString = "";
			_.each(years, function(year) {
				var selected = ( year === targetYear )? "selected": "";
				htmlString += "<li data-year='" + year + "' class='year-btn " + selected + "'><a href='#' class='btn'>" + owid.displayYear(year) + "</a></li>";
			});
			
			this.$buttonsWrapper.append( $( htmlString ) );
			
			this.$buttons = this.$buttonsWrapper.find( "li" );
			this.$buttons.on( "click", $.proxy( this.onButtonClick, this ) );

		},

		onButtonClick: function( evt ) {
			evt.preventDefault();
			var $btn = $( evt.currentTarget ),
				targetYear = parseInt( $btn.attr( "data-year" ), 10 );
			App.ChartModel.updateMapConfig( "targetYear", targetYear, false, "change-map" );
		
		},

		onChartModelChange: function() {
			this.render();
		},

		show: function() {
			this.$el.css( "display", "table" );
		},

		hide: function() {
			this.$el.css( "display", "none" );
		}

	});

	module.exports = App.Views.Chart.Map.ButtonsControl;

})();