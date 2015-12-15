;( function() {
	
	"use strict";

	var App = require( "./namespaces.js" ),
		Backbone = require( "backbone" );

	App.Router = Backbone.Router.extend({

		routes: {
				"chart": "onChartRoute",
				"data": "onDataRoute",
				"map": "onMapRoute",
				"sources": "onSourcesRoute",
				"*default": "onDefaultRoute"
		},

		onChartRoute: function() {
			this.displayTab( "chart" );
		},

		onDataRoute: function() {
			this.displayTab( "data" );
		},

		onMapRoute: function() {
			this.displayTab( "map" );
		},

		onSourcesRoute: function() {
			this.displayTab( "sources" );
		},

		displayTab: function( id ) {
			console.log("displayTab",id);
			App.View.chartView.displayTab( id );
		}

	});

	module.exports = App.Router;

})();