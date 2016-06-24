;(function() {	
	"use strict";
	owid.namespace("App.Views.Form.ChartTypeSectionView");

	App.Views.Form.ChartTypeSectionView = Backbone.View.extend({
		el: "#form-view #basic-tab .chart-type-section",
		events: {
			"change [name='chart-type']": "onChartTypeChange",
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			this.$chartTypeSelect = this.$el.find("[name='chart-type']");

			App.ChartModel.on("change:chart-type", this.render, this);
			this.render();
		},

		render: function() {
			var selectedChartType = App.ChartModel.get("chart-type");
			this.$chartTypeSelect.val(selectedChartType);
		},

		onChartTypeChange: function() {
			var newChartType = this.$chartTypeSelect.val();
			App.ChartModel.set("chart-type", newChartType);
			App.ChartDimensionsModel.loadConfiguration(newChartType);
		}
	});
})();