;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.Map.TimelineControls");
	var PlayPauseControl = App.Views.Chart.Map.PlayPauseControl,
		TimelineControl = App.Views.Chart.Map.TimelineControl,
		ButtonsControl = App.Views.Chart.Map.ButtonsControl;

	App.Views.Chart.Map.TimelineControls = Backbone.View.extend({
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
			var mapConfig = App.ChartModel.get("map-config");
			
			this.playPauseControl.render();
			this.timelineControl.render();
			this.buttonsControl.render();

			//depending on the mode used display timeline mode or buttons mode
			if (mapConfig.timelineMode === "buttons") {	
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
})();