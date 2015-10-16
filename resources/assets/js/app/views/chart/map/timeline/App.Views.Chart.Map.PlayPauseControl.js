;( function() {
	
	"use strict";

	var App = require( "./../../../../namespaces.js" );

	App.Views.Chart.Map.PlayPauseControl = Backbone.View.extend({

		PLAY_INTERVAL: 1000,

		el: "#map-chart-tab .map-timeline-controls .play-pause-control",
		events: {
			"click .play-btn": "onPlayClick",
			"click .pause-btn": "onPauseClick",
		},

		initialize: function( options ) {

			this.dispatcher = options.dispatcher;

			this.interval = null;
			this.$playBtn = this.$el.find( ".play-btn" );
			this.$pauseBtn = this.$el.find( ".pause-btn" );
			
			this.dispatcher.on( "max-increment-time", this.onMaxIncrement, this );

			//App.ChartModel.on( "change", this.onChartModelChange, this );
			//App.ChartModel.on( "change-map", this.onChartModelChange, this );

			return this.render();
		},

		render: function() {
			
		},

		onPlayClick: function( evt ) {
			if( evt ) {
				evt.preventDefault();
			}
			this.startTimer();

			this.$pauseBtn.show();
			this.$playBtn.hide();
		},

		onPauseClick: function( evt ) {
			if( evt ) {
				evt.preventDefault();
			}
			this.clearTimer();

			this.$pauseBtn.hide();
			this.$playBtn.show();
		},

		startTimer: function() {
			this.clearTimer();
			var that = this;
			this.interval = setInterval( function() {
				that.incrementTime();
				}, this.PLAY_INTERVAL
			);
			that.incrementTime();
		},

		onMaxIncrement: function() {
			this.onPauseClick();
		},

		incrementTime: function() {
			this.dispatcher.trigger( "increment-time" );
		},

		clearTimer: function() {
			if( this.interval ) {
				clearInterval( this.interval );
			}
		}

	});

	module.exports = App.Views.Chart.Map.PlayPauseControl;

})();