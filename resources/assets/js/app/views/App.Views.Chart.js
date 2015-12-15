;( function() {
	
	"use strict";

	var App = require( "./../namespaces.js" ),
		Router = require( "./../App.Router.js" ),
		ChartView = require( "./App.Views.ChartView.js" );

	App.Views.Chart = Backbone.View.extend({

		events: {},

		initialize: function() {},

		start: function() {
			
			//render everything for the first time
			this.render();
			
			/*//setup router
			new Router();

			console.log("start backbone router");
			//start backbone tracking
			Backbone.history.start();*/

		},

		render: function() {
			
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			this.chartView = new ChartView( { dispatcher: dispatcher } );
			
		}

	});

	module.exports = App.Views.Chart;

})();
