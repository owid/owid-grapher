;(function() {		
	"use strict";
	owid.namespace("App.Views.Form.TimeSectionView");

	App.Views.Form.TimeSectionView = owid.View.extend({

		el: "#form-view #data-tab .time-section",
		events: {
			"change [name='dynamic-time']": "onDynamicTimeToggle",
			"change [name='chart-time-from']": "onChartTimeChange",
			"change [name='chart-time-to']": "onChartTimeChange"
		},

		initialize: function( options ) {			
			this.dispatcher = options.dispatcher;
			this.listenTo(App.VariableData, "change", this.render.bind(this));
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
				minDataYear = App.VariableData.get("minYear"),
				maxDataYear = App.VariableData.get("maxYear"),
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
					this.onChartTimeChange(false);
				}.bind(this),
				onStart: function() {
					this.onDynamicTimeToggle();
				}.bind(this)
			};

			if (!slider)
				this.$chartTime.ionRangeSlider(sliderOptions);
			else
				slider.update(sliderOptions);

			this.$el.find(".irs").toggleClass("disabled", isDynamicTime);
		},

		onDynamicTimeToggle: function() {
			var isDynamicTime = this.$dynamicTime.prop("checked");
			this.$chartTimeFrom.prop("readonly", isDynamicTime);
			this.$chartTimeTo.prop("readonly", isDynamicTime);
			this.$el.find(".irs").toggleClass("disabled", isDynamicTime);
			if (isDynamicTime)
				App.ChartModel.set("chart-time", null);
			else
				this.onChartTimeChange(true);
		},

		onChartTimeChange: function(shouldUpdateSlider) {
			var slider = this.$chartTime.data("ionRangeSlider"),
				minYear = this.$chartTimeFrom.val(),
				maxYear = this.$chartTimeTo.val();

			if (!_.isFinite(minYear) || !_.isFinite(maxYear)) return;

			App.ChartModel.set("chart-time", [minYear, maxYear]); 
			if (slider && shouldUpdateSlider) {
				slider.update({'from': minYear, 'to': maxYear});
			}
		},
	});
})();