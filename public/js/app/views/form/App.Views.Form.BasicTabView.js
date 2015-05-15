;( function() {
	
	"use strict";

	App.Views.Form.BasicTabView = Backbone.View.extend({

		el: "#form-view #basic-tab",
		events: {
			"input [name=chart-variable]": "onChartVariableChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.render();

		},

		render: function() {

			this.$chartVariable = this.$el.find( "[name=chart-variable]" );
			//this.onChartVariableChange();

		},

		onChartVariableChange: function() {

			App.ChartModel.set( "chart-variable", this.$chartVariable.val() );

		}


	});

})();