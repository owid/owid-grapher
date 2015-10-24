;( function() {
	
	"use strict";

	var App = require( "./../../../../namespaces.js" ),
		PlayPauseControl = require( "./App.Views.Chart.Map.PlayPauseControl" ),
		TimelineControl = require( "./App.Views.Chart.Map.TimelineControl.js" ),
		ButtonsControl = require( "./App.Views.Chart.Map.ButtonsControl.js" );

	App.Views.Chart.Map.TimelineControl = Backbone.View.extend({

		el: "#map-chart-tab .map-timeline-controls",
		events: {},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;

			this.playPauseControl = new PlayPauseControl( options );
			this.timelineControl = new TimelineControl( options );
			this.buttonsControl = new ButtonsControl( options );

			App.ChartModel.on( "change-map", this.onChartModelChange, this );

			return this.render();
		},

		render: function() {

			var mapConfig = App.ChartModel.get( "map-config" );
			
			//depending on the mode used display timeline mode or buttons mode
			if( mapConfig.timelineMode === "buttons" ) {
				
				this.playPauseControl.hide();
				this.timelineControl.hide();
				this.buttonsControl.show();

			} else {

				this.playPauseControl.show();
				this.timelineControl.show();
				this.buttonsControl.hide();

			}

			//should be timline disabled
			var isRange = ( isNaN( mapConfig.minYear ) || isNaN( mapConfig.maxYear ) )? true: false,
				isSingleYear = ( !isRange && ( mapConfig.minYear == mapConfig.maxYear ) )? true: false;

			if( isRange || isSingleYear ) {
				this.$el.addClass( "single-year" );
			} else {
				this.$el.removeClass( "single-year" );
			}

		},

		onChartModelChange: function() {
			this.render();
		}

	});

	module.exports = App.Views.Chart.Map.TimelineControl;

})();