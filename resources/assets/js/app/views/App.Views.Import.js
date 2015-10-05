;( function() {
	
	"use strict";

	var App = require( "./../namespaces.js" ),
		ImportView = require( "./App.Views.ImportView.js" );
	
	App.Views.Import = Backbone.View.extend({

		events: {},

		initialize: function() {},

		start: function() {
			//render everything for the first time
			this.render();
		},

		render: function() {
			
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			this.importView = new ImportView( {dispatcher: dispatcher } );
			
		}

	});

	module.exports = App.Views.Import;

})();
