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
			this.$dataTable = this.$el.find(".data-table");
		},

		activate: function() {
			this.render();
			App.ChartModel.on("change", this.render.bind(this), this);
		},

		deactivate: function() {
			App.ChartModel.off(null, null, this);
		},

		render: function() {
			var params = owid.getQueryParams();
			delete(params.tab);
			var queryStr = owid.queryParamsToStr(params),
				baseUrl = Global.rootUrl + "/" + App.ChartModel.get("chart-slug"),
				csvUrl = baseUrl + ".csv" + queryStr;

			this.$downloadBtn.attr("href", csvUrl);

			Papa.parse(csvUrl, {
				download: true,
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
				}.bind(this)
			})

		},
	});
})();