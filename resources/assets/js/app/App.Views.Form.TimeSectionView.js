;(function() {		
	"use strict";
	owid.namespace("App.Views.Form.TimeSectionView");

	App.Views.Form.TimeSectionView = Backbone.View.extend({

		el: "#form-view #data-tab .time-section",
		events: {
			"change [name='dynamic-time']": "onDynamicTimeToggle",
			"change [name='chart-time-from']": "onChartTimeChange",
			"change [name='chart-time-to']": "onChartTimeChange"
		},

		initialize: function( options ) {			
			this.dispatcher = options.dispatcher;
			App.DataModel.on("change", this.render, this);
			this.render();
		},

		render: function() {
			this.$entitiesSelect = this.$el.find(".countries-select");
			this.$chartTime = this.$el.find("[name='chart-time']");
			this.$dynamicTime = this.$el.find("[name='dynamic-time']");

			this.$chartTimeFrom = this.$el.find("[name='chart-time-from']");
			this.$chartTimeTo = this.$el.find("[name='chart-time-to']");

			var chartTime = App.ChartModel.get("chart-time"),
				isDynamicTime = _.isEmpty(chartTime),
				minDataYear = App.DataModel.get("minYear") || 0,
				maxDataYear = App.DataModel.get("maxYear") || new Date().getFullYear(),
				minYear = isDynamicTime ? minDataYear : chartTime[0],
				maxYear = isDynamicTime ? maxDataYear : chartTime[1],
				slider = this.$chartTime.data("ionRangeSlider");

			this.$dynamicTime.prop("checked", isDynamicTime);
			this.$chartTimeFrom.val(minYear);
			this.$chartTimeTo.val(maxYear);

			var sliderOptions = {
				type: "double",
				min: minDataYear,
				max: maxDataYear,
				from: minYear,
				to: maxYear,
				grid: true,
				onChange: function(data) {
					this.$chartTimeFrom.val(data.from);
					this.$chartTimeTo.val(data.to);
					App.ChartModel.set("chart-time", [data.from, data.to]); 
				}.bind(this),
				onStart: function() {
					this.onDynamicTimeToggle();
				}.bind(this)
			};

			if (!slider)
				this.$chartTime.ionRangeSlider(sliderOptions);
			else
				slider.update(sliderOptions);
		},

		onDynamicTimeToggle: function() {
			var isDynamicTime = this.$dynamicTime.prop("checked");
			this.$chartTimeFrom.prop("readonly", isDynamicTime);
			this.$chartTimeTo.prop("readonly", isDynamicTime);
			this.$el.find(".irs").toggleClass("disabled", isDynamicTime);
			if (isDynamicTime)
				App.ChartModel.set("chart-time", null);
			else
				this.onChartTimeChange();
		},

		onChartTimeChange: function() {
			var slider = this.$chartTime.data("ionRangeSlider"),
				minYear = this.$chartTimeFrom.val(),
				maxYear = this.$chartTimeTo.val();

			App.ChartModel.set("chart-time", [minYear, maxYear]); 
			if (slider)
				slider.update({'from': minYear, 'to': maxYear});
		},
	});
})();