;(function() {	
	"use strict";
	owid.namespace("owid.tab.data");

	owid.tab.data = function() {
		var model;

		function dataTab() { };

		dataTab.model = function(_) {
			return arguments.length ? model = _ && dataTab : model;
		};

		return dataTab;
	};

	App.Views.Chart.DataTab = owid.View.extend({
		el: "#chart #data-chart-tab",
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
			this.listenTo(App.ChartModel, "change:", function() { this.needsRender = true; }.bind(this));
		},

		deactivate: function() {
			this.cleanup();
			this.$dataTable.empty();
		},

		render: function(callback) {
			if (!this.needsRender) return;

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