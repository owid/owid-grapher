;(function() {
	"use strict";
	owid.namespace("owid.tab.map");

	var MapControls = App.Views.Chart.Map.MapControls,
		TimelineControls = App.Views.Chart.Map.TimelineControls,
		owdProjections = App.Views.Chart.Map.Projections,
		Legend = App.Views.Chart.Map.Legend;

	owid.tab.map = function(chart) {
		function mapTab() { }

		var changes = owid.changes();
		changes.track(chart.map);
		changes.track(chart.mapdata);
		changes.track(chart, 'tabBounds activeTab');

		var dataMap, bordersDisclaimer;
		var svg, svgNode, offsetY, availableWidth, availableHeight, bounds;

		var dispatcher = _.clone(Backbone.Events),
			mapControls = new MapControls({ dispatcher: dispatcher }),
			timeline;

		// Open the chart tab for a country when it is clicked (but not on mobile)
		function onMapClick(ev) {
			if ($('#chart').hasClass('mobile') || !_.includes(chart.model.get("tabs"), "chart")) return;

			d3.select(ev.target).each(function(d) {
				var entityName = d.id,
					availableEntities = chart.vardata.get("availableEntities"),
					entity = _.find(availableEntities, function(e) {
						return owid.entityNameForMap(e.name) == d.id;
					});

				if (!entity) return;
				chart.model.set({ "selected-countries": [entity] }, { silent: true });
				chart.data.chartData = null;
				chart.display.set({ activeTab: 'chart' });
				chart.url.updateCountryParam();
			});
		}

		function onMapHover(ev) {
			chart.tooltip.fromMap(ev, ev.target);
		}

		function onMapHoverStop(ev) {
			chart.tooltip.hide();
		}

		function initializeMap() {
			svg = d3.select('svg.datamap');

			chart.$('g.datamaps-subunits').on('click', 'path', onMapClick);
			chart.$('g.datamaps-subunits').on('mouseenter', 'path', onMapHover);
			chart.$('g.datamaps-subunits').on('mouseleave', 'path', onMapHoverStop);
		}

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
				containerNode: chart.svg,
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