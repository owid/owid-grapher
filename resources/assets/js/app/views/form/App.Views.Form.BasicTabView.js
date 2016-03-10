;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" );

	App.Views.Form.BasicTabView = Backbone.View.extend({

		el: "#form-view #basic-tab",
		events: {
			"change input[name=chart-name]": "onNameChange",
			"change textarea[name=chart-subname]": "onSubnameChange",			
			"change textarea[name=chart-notes]": "onNotesChange"
		},

		initialize: function( options ) {
			if (window.location.hash === "")
				window.location.hash = "#basic-tab";

			this.dispatcher = options.dispatcher;
			this.render();
		},

		render: function() {
			this.$el.find( "[name=chart-name]" ).val( App.ChartModel.get( "chart-name" ) );
			this.$el.find( "[name=chart-subname]" ).val( App.ChartModel.get( "chart-subname" ) );
			this.$el.find("[name=chart-notes]").val(App.ChartModel.get("chart-notes"));
		},

		onNameChange: function( evt ) {
			var $input = $( evt.target );
			App.ChartModel.set( "chart-name", $input.val() );
		},

		onSubnameChange: function( evt ) {
			var $textarea = $( evt.target );
			App.ChartModel.set( "chart-subname", $textarea.val() );
		},

		onNotesChange: function(evt) {
			var $textarea = $(evt.target);
			App.ChartModel.set("chart-notes", $textarea.val());
		}

	});

	module.exports = App.Views.Form.BasicTabView;

})();
