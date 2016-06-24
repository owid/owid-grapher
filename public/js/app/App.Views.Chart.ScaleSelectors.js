;(function() {	
	"use strict";

	window.App = window.App || {};
	App.Views = App.Views || {};
	App.Views.Chart = App.Views.Chart || {};

	App.Views.Chart.ScaleSelectors = Backbone.View.extend({

		el: "#chart-view .axis-scale-selectors-wrapper",
		events: {
			"click .axis-scale-btn": "onAxisScaleBtn",
			"change .axis-scale li": "onAxisScaleChange"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.$tabs = this.$el.find( ".header-tab" );
			
			this.$xAxisScale = this.$el.find( "[data-name='x-axis-scale']" );
			this.$yAxisScale = this.$el.find( "[data-name='y-axis-scale']" );
			this.$xAxisBtn = this.$el.find(".x-axis-scale-selector .axis-scale-btn");
			this.$yAxisBtn = this.$el.find(".y-axis-scale-selector .axis-scale-btn");


			this.render();
			App.ChartModel.on( "change", this.render, this );
		},

		render: function() {			
			var xScale = App.ChartModel.getAxisConfig("x-axis", "axis-scale");
			this.$xAxisBtn.find('span').text(s.capitalize(xScale));

			var yScale = App.ChartModel.getAxisConfig("y-axis", "axis-scale");
			this.$yAxisBtn.find('span').text(s.capitalize(yScale));
		},

		onAxisScaleBtn: function(evt) {			
			evt.preventDefault();

			var $btn = $(evt.currentTarget),
				$div = $btn.closest("div"),
				divName = $div.attr("data-name"),
				axisName  = (name == "x-axis-scale") ? "x-axis" : "y-axis",
				currentScale = App.ChartModel.getAxisConfig(axisName, "axis-scale");


			if (currentScale != "linear") 
				App.ChartModel.setAxisConfig(axisName, "axis-scale", "linear");
			else
				App.ChartModel.setAxisConfig(axisName, "axis-scale", "log");
		}

	});	
})();
