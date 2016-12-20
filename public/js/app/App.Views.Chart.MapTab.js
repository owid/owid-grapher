;(function() {
	"use strict";
	owid.namespace("owid.tab.map");

	var MapControls = App.Views.Chart.Map.MapControls,
		TimelineControls = App.Views.Chart.Map.TimelineControls,
		owdProjections = App.Views.Chart.Map.Projections,
		Legend = App.Views.Chart.Map.Legend;

	owid.tab.map = function(chart) {
		function mapTab() { }

		var dataMap, bordersDisclaimer;
		var svg, offsetY, availableWidth, availableHeight, bounds;

		var dispatcher = _.clone(Backbone.Events),
			mapControls = new MapControls({ dispatcher: dispatcher }),
			timeline;

		mapTab.deactivate = function() {
			chart.tooltip.hide();
			$('.datamaps-hoverover').remove();
			d3.selectAll(".datamaps-subunits, .border-disclaimer, .legend, .map-bg").remove();			
			$("svg").removeClass("datamap");
			dataMap = null;
			changes.done();

			if (timeline) {
				timeline.remove();
				timeline = null;				
			}
		};

		var control = owid.control.mapWithTimeline(chart);

		mapTab.render = function(inputBounds) {
			mapTab.control = control;
			bounds = inputBounds;

			$(".chart-error").remove();
			if (!chart.map.getVariable()) {
				chart.showMessage("No variable selected for map.");
				return;
			}

			chart.mapdata.update();

			control.update({
				containerNode: chart.svg.node(),
				bounds: bounds,
				colorData: chart.mapdata.currentValues,
				years: chart.map.getYears(),
				inputYear: chart.map.get('targetYear'),
				legendData: chart.mapdata.legendData,
				legendTitle: chart.mapdata.legendTitle||null
			}, chart.dispatch.renderEnd);
		};

		return mapTab;
	};
})();