;(function() {	
	"use strict";
	owid.namespace("owid.view.tooltip");

	owid.view.tooltip = function(chart) {
		function tooltip() {}

		var $tooltip = $('<div class="nvtooltip tooltip-xy owid-tooltip"></div>');
		$('body').append($tooltip);
		$tooltip.hide();

		tooltip.fromMap = function(ev, node) {
			// MISPY TODO: clean this up
			d3.select(node).each(function(d) {
				var datum = chart.tabs.map.dataMap.options.data[d.id],
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

					var bounds = chart.getBounds(node);
					$tooltip.css({
						position: 'absolute',
						left: ev.pageX,
						top: ev.pageY
					});
					$tooltip.show();
				}

			});
		};

		tooltip.hide = function() {
			$tooltip.hide();
		};

		return tooltip;
	};

})();