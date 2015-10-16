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

			return this.render();
		},

		render: function() {}

	});

	module.exports = App.Views.Chart.Map.TimelineControl;

})();