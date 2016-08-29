;(function() {	
	"use strict";
	owid.namespace("owid.tab.data");

	owid.tab.data = function(chart) {
		function dataTab() { }

		var	$tab = chart.$("#data-chart-tab"),
			$downloadBtn = $tab.find(".download-data-btn"),
			$downloadFullBtn = $tab.find(".download-full-btn"),
			$dataTable = $tab.find(".data-table");

		dataTab.render = function() {
			var params = owid.getQueryParams();
			delete(params.tab);
			var queryStr = owid.queryParamsToStr(params),
				baseUrl = Global.rootUrl + "/" + App.ChartModel.get("chart-slug"),
				csvUrl = baseUrl + ".csv" + queryStr;

			$downloadBtn.attr("href", csvUrl);
			$downloadFullBtn.attr("href", baseUrl + ".csv" + "?country=ALL");

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

							$dataTable.html(rowHtml);
						}
					});
				})
				.fail(function(err) {
					App.ChartView.handleError(err);
				});			
		};

		return dataTab;
	};

	App.Views.Chart.DataTab = owid.View.extend({
		el: "#chart #data-chart-tab",
		events: {},

		initialize: function( options ) {
			this.parentView = options.parentView;
			this.dispatcher = options.dispatcher;

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

		},
	});
})();