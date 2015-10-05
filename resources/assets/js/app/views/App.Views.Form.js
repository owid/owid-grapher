;( function() {
	
	"use strict";

	var App = require( "./../namespaces.js" ),
		FormView = require( "./App.Views.FormView.js" ),
		ChartView = require( "./App.Views.ChartView.js" ),
		VariableSelects = require( "./ui/App.Views.UI.VariableSelects.js" );

	App.Views.Form = Backbone.View.extend({

		events: {},

		initialize: function() {},

		start: function() {
			//render everything for the first time
			this.render();
		},

		render: function() {
			
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			this.formView = new FormView( { dispatcher: dispatcher } );
			this.chartView = new ChartView( { dispatcher: dispatcher } );
			
			//variable select
			var variableSelects = new VariableSelects();
			variableSelects.init();
			
		}

	});

	module.exports = App.Views.Form;

})();
