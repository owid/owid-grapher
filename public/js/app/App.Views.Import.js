;(function() {	
	"use strict";
	owid.namespace("App.Views.Import");

	var ImportView = require("App.Views.ImportView");
	
	App.Views.Import = Backbone.View.extend({
		events: {},

		initialize: function() {},

		start: function() {
			this.render();
		},

		render: function() {
			var dispatcher = _.clone( Backbone.Events );
			this.dispatcher = dispatcher;

			this.importView = new ImportView( {dispatcher: dispatcher } );			
		}
	});
})();
