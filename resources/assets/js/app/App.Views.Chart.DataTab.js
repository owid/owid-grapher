;(function() {	
	"use strict";
	owid.namespace("App.Views.Chart.DataTab");

	App.Views.Chart.DataTab = Backbone.View.extend({
		el: "#chart-view #data-chart-tab",
		events: {},

		initialize: function( options ) {
			this.parentView = options.parentView;
			this.dispatcher = options.dispatcher;

			this.$tab = this.$el;
			this.$downloadBtn = this.$el.find(".download-data-btn");
			this.$downloadFullBtn = this.$el.find(".download-full-btn");
			this.$dataTable = this.$el.find(".data-table");
		},

		activate: function(callback) {
			this.render(callback);
			App.ChartModel.on("change", this.render.bind(this), this);
		},

		deactivate: function() {
			App.ChartModel.off(null, null, this);
			this.$dataTable.empty();
		},

		render: function(callback) {
			var params = owid.getQueryParams();
			delete(params.tab);
			var queryStr = owid.queryParamsToStr(params),
				baseUrl = Global.rootUrl + "/" + App.ChartModel.get("chart-slug"),
				csvUrl = baseUrl + ".csv" + queryStr;

			this.$downloadBtn.attr("href", csvUrl);
			this.$downloadFullBtn.attr("href", baseUrl + ".csv" + "?country=ALL");

			$.get(csvUrl)
				.done(function(csv) {
					Papa.parse(csv, {
						complete: function(results) {
							console.log(results);
							var rowHtml = "";
							_.each(results.data, function(row) {
								rowHtml += "<tr>";
								_.each(row, function(value) {
									rowHtml += "<td>" + value + "</td>";
								});
								rowHtml += "</tr>";
							});

							this.$dataTable.html(rowHtml);
							if (_.isFunction(callback)) callback();
						}.bind(this)
					});
				}.bind(this))
				.fail(function(err) {
					App.ChartView.handleError(err);
				});
		},
	});
})();