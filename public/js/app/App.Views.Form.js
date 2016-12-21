;(function() {	
	"use strict";
	owid.namespace("App.Views.Form");

	var FormView = require("App.Views.FormView");

	App.Views.Form = owid.View.extend({
		events: {},

		initialize: function() {

		},

		start: function() {
			//render everything for the first time
			this.render();
		},

		render: function() {
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			this.chart = owid.chart();
			
			//is edit/create module
			if( $( ".chart-edit-module" ).length ) {
				this.formView = new FormView( { dispatcher: dispatcher } );
				//variable select
			}			
		}
	});
})();
