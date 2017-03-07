import _ from 'underscore'

;(function(d3) {	
	"use strict";
	owid.namespace("owid.view.tooltip");

	owid.tooltip = function(svgNode, left, top, data) {		
		var container = d3.select(svgNode.parentNode);

		var tooltipUpdate = container.selectAll('.owid-tooltip');

		var tooltip = tooltipUpdate.data([data]).enter()
			.append('div').attr('class', 'owid-tooltip')
			.style('position', 'absolute')
			.merge(tooltipUpdate)
				.html(function(d) { return owid.scatterPlotTooltipGenerator(d); })
				.classed('hidden', false);

		var width = tooltip.node().getBoundingClientRect().width,
			containerWidth = container.node().getBoundingClientRect().width;

		if (left*chart.scale + width > containerWidth)
			left = left - width/chart.scale;

		tooltip
			.style('left', left*chart.scale + 'px')
			.style('top', top*chart.scale + 'px');
	};

	owid.tooltipHide = function(svgNode) {
		var container = d3.select(svgNode.parentNode),
			tooltip = container.selectAll('.owid-tooltip');

		tooltip.classed('hidden', true);
	};

	owid.view.tooltip = function(chart) {
		function tooltip() {}

		var $tooltip = $('<div class="nvtooltip tooltip-xy owid-tooltip"></div>');
		$('body').append($tooltip);
		$tooltip.hide();

		tooltip.fromMap = function(d, ev) {
			var datum = chart.mapdata.currentValues[d.id],
				availableEntities = chart.vardata.get("availableEntities"),
				entity = _.find(availableEntities, function(e) {
					return owid.entityNameForMap(e.name) == d.id;
				});

			if (!datum || !entity) {
				// No data available
				$tooltip.hide();
			} else {
				//transform datamaps data into format close to nvd3 so that we can reuse the same popup generator
				var variableId = App.MapModel.get("variableId"),
					propertyName = App.Utils.getPropertyByVariableId(App.ChartModel, variableId) || "y";

				var obj = {
					point: {
						time: datum.year
					},
					series: [{
						key: entity.name
					}]
				};
				obj.point[propertyName] = datum.value;
				$tooltip.html(owid.contentGenerator(obj, true));

				$tooltip.css({
					position: 'absolute',
					left: ev.pageX,
					top: ev.pageY
				});
				$tooltip.show();
			}
		};

		tooltip.hide = function() {
			$tooltip.hide();
		};

		return tooltip;
	};

})(d3v4);