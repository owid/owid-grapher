;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

	App.Views.Form.BasicTabView = Backbone.View.extend({

		el: "#form-view #basic-tab",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.render();

		},

		render: function() {
			
			this.$el.find( "[name=chart-name]" ).val( App.ChartModel.get( "chart-name" ) );
			this.$el.find( "[name=chart-subname]" ).val( App.ChartModel.get( "chart-subname" ) );

		}

	});

	module.exports = App.Views.Form.BasicTabView;

})();
