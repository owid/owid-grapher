;( function() {
	
	"use strict";

	var App = require( "./../namespaces.js" ),
		ChartView = require( "./App.Views.ChartView.js" );

	App.Views.Chart = Backbone.View.extend({

		events: {},

		initialize: function() {},

		start: function() {
			//render everything for the first time
			this.render();
		},

		render: function() {
			
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			this.chartView = new ChartView( { dispatcher: dispatcher } );
			
		}

	});

	module.exports = App.Views.Chart;

})();
