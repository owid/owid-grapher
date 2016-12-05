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
		var svg, svgNode, svgBounds, offsetY, availableWidth, availableHeight;

		var dispatcher = _.clone(Backbone.Events),
			mapControls = new MapControls({ dispatcher: dispatcher }),
			legend = owid.map.legend(chart),
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

		function calculateBounds() {
			if (!changes.any('tabBounds activeTab targetYear timeRanges'))
				return;

			svgNode = chart.$('svg').get(0);
			svgBounds = chart.getBounds(svgNode);
			offsetY = chart.tabBounds.top - svgBounds.top;
			availableWidth = chart.tabBounds.right - chart.tabBounds.left;
			availableHeight = chart.tabBounds.bottom - chart.tabBounds.top;

			var years = chart.map.getYears();
			if (years.length > 1 && !App.isExport) {
				if (!timeline) {
					timeline = owid.view.timeline();

					timeline.flow('targetYear', function(targetYear) {
						chart.map.set('targetYear', targetYear);
					});
				}

				var timelineHeight = 50;
				timeline.update({
					containerNode: chart.html,
					bounds: { top: offsetY+availableHeight-timelineHeight, left: 0, width: availableWidth, height: timelineHeight },
					years: years, // Range of years the timeline covers
					targetYear: chart.map.get('targetYear')
				});

				// Adjust availableHeight to compensate for timeline controls
				availableHeight -= timelineHeight;
			} else {
				if (timeline) {
					timeline.remove();
					timeline = null;
				}
			}
		}

		function initializeMap() {
			if (dataMap) return;

			var $oldSvg = $("svg");			

			Datamap.prototype.worldTopo = null; // seems to be necessary for dataJson to be recognized
			dataMap = new Datamap({
				element: $(".chart-inner").get(0),
				responsive: false,
				geographyConfig: {
					dataJson: owid.data.world,
					borderWidth: 0.3,
					borderColor: '#4b4b4b',
					highlightFillColor: chart.mapdata.getNoDataColor(),
					highlightBorderWidth: 3,
					highlightBorderColor: '#FFEC38',
					popupOnHover: false,
					hideAntarctica: true
				},
				fills: {
					defaultFill: chart.mapdata.getNoDataColor()
				},
				setProjection: owdProjections.World
			});
			mapTab.dataMap = dataMap;

			// HACK (Mispy): Workaround for the fact that datamaps insists on creating
			// its own SVG element instead of injecting into an existing one.
			$oldSvg.children().appendTo($("svg.datamap"));
			$oldSvg.remove();
			svg = d3.select('svg.datamap');

			chart.$('g.datamaps-subunits').on('click', 'path', onMapClick);
			chart.$('g.datamaps-subunits').on('mouseenter', 'path', onMapHover);
			chart.$('g.datamaps-subunits').on('mouseleave', 'path', onMapHoverStop);
		}

		function updateLegend() {
			legend.update();
		}

		// Transforms the datamaps SVG to fit the container and focus a particular region if needed
		function updateViewport() {
			if (!changes.any('tabBounds projection timeRanges activeTab')) return;

			var map = d3.select(".datamaps-subunits");			

			var viewports = {
				"World": { x: 0.525, y: 0.5, width: 1, height: 1 },
				"Africa": { x: 0.48, y: 0.70, width: 0.21, height: 0.38 },
				"N.America": { x: 0.49, y: 0.40, width: 0.19, height: 0.32 },
				"S.America": { x: 0.52, y: 0.815, width: 0.10, height: 0.26 },
				"Asia": { x: 0.49, y: 0.52, width: 0.22, height: 0.38 },
				"Australia": { x: 0.51, y: 0.77, width: 0.1, height: 0.12 },
				"Europe": { x: 0.54, y: 0.54, width: 0.05, height: 0.15 },
			};

			var viewport = viewports[chart.map.get('projection')];

			// Calculate our reference dimensions. All of these values are independent of the current
			// map translation and scaling-- getBBox() gives us the original, untransformed values.
			var mapBBox = map.node().getBBox(),
				mapWidth = mapBBox.width,
				mapHeight = mapBBox.height,
				mapX = svgBounds.left + mapBBox.x + 1,
				mapY = svgBounds.top + mapBBox.y + 1,
				viewportWidth = viewport.width*mapWidth,
				viewportHeight = viewport.height*mapHeight;

			// Calculate what scaling should be applied to the untransformed map to match the current viewport to the container
			var scaleFactor = Math.min(availableWidth/viewportWidth, availableHeight/viewportHeight),
				scaleStr = "scale(" + scaleFactor + ")";

			// Work out how to center the map, accounting for the new scaling we've worked out
			var newWidth = mapWidth*scaleFactor,
				newHeight = mapHeight*scaleFactor,
				tabCenterX = chart.tabBounds.left + availableWidth / 2,
				tabCenterY = chart.tabBounds.top + availableHeight / 2,
				newCenterX = mapX + (scaleFactor-1)*mapBBox.x + viewport.x*newWidth,
				newCenterY = mapY + (scaleFactor-1)*mapBBox.y + viewport.y*newHeight,
				newOffsetX = tabCenterX - newCenterX,
				newOffsetY = tabCenterY - newCenterY,
				translateStr = "translate(" + newOffsetX + "px," + newOffsetY + "px)";

			var matrixStr = "matrix(" + scaleFactor + ",0,0," + scaleFactor + "," + newOffsetX + "," + newOffsetY + ")";
			map.attr('transform', matrixStr);
		}

		function updateMapBackground() {
			if (changes.any('activeTab')) {
				svg.insert("rect", "*")
					.attr("class", "map-bg")
					.attr("x", 0).attr("y", 0);
			}

			if (changes.any('tabBounds activeTab timeRanges')) {
				svg.select(".map-bg")
					.attr("y", chart.tabBounds.top - svgBounds.top)
					.attr("width", chart.tabBounds.width)
					.attr("height", availableHeight);
			}
		}

		// For maps earlier than 2011, display a disclaimer noting that data is mapped
		// on current rather than historical borders
		function updateBorderDisclaimer() {
			var borderDisclaimer = svg.select(".border-disclaimer");
			if (chart.map.getMinYear() >= 2012) {
				borderDisclaimer.remove();
				return;
			}

			if (borderDisclaimer.empty()) {
				borderDisclaimer = svg.append("text");
				borderDisclaimer.attr("class", "border-disclaimer")
					.attr('text-anchor', 'end')
					.text("Mapped on current borders");
			}

			if (changes.any('tabBounds')) {
				var node = borderDisclaimer.node(),
					x = availableWidth - 10,
					y = offsetY + availableHeight - 10;
				borderDisclaimer.attr("transform", "translate(" + x + "," + y + ")");
			}
		}

		function updateProjection() {
			// If we've changed the projection (i.e. zooming on Africa or similar) we need
			// to redraw the datamap before injecting new data
			var oldProjection = dataMap.options.setProjection,
				newProjection = owdProjections[chart.map.get("projection")];

			if (oldProjection !== newProjection) {
				d3.selectAll("path.datamaps-subunit").remove();
				dataMap.options.setProjection = newProjection;
				dataMap.draw();
			}
		}

		mapTab.deactivate = function() {
			chart.tooltip.hide();
			$('.datamaps-hoverover').remove();
			d3.selectAll(".datamaps-subunits, .border-disclaimer, .legend, .map-bg").remove();			
			$("svg").removeClass("datamap");
			dataMap = null;
			changes.done();

			timeline.remove();
			timeline = null;
		};

		mapTab.render = function() {
			$(".chart-error").remove();
			if (!chart.map.getVariable()) {
				chart.showMessage("No variable selected for map.");
				return;
			}

			chart.mapdata.update();

			if (!changes.start()) return;

			initializeMap();
			if (!changes.only('targetYear')) {
				mapControls.render();
			}
			calculateBounds();
			updateMapBackground();
			updateBorderDisclaimer();
			updateProjection();
			updateViewport();
			updateLegend();

			dataMap.options.fills.defaultFill = chart.mapdata.getNoDataColor();
			dataMap.updateChoropleth(chart.mapdata.currentValues, { reset: true });
			dataMap.options.data = chart.mapdata.currentValues;
			d3.selectAll("svg.datamap").transition().each("end", function() {
				chart.dispatch.renderEnd();
			});


			changes.done();

			if (!this.postInit) {
				// Set the post-initial-render defaults
				var mapConfig = chart.map.attributes;
				chart.map.set({
					targetYear: mapConfig.defaultYear || mapConfig.targetYear,
					projection: mapConfig.defaultProjection || mapConfig.projection
				});				
				this.postInit = true;
				mapTab.render();
			}
		};

		return mapTab;
	};
})();

(function() {
	var ε = 1e-6, ε2 = ε * ε, π = Math.PI, halfπ = π / 2, sqrtπ = Math.sqrt(π), radians = π / 180, degrees = 180 / π;
	function sinci(x) {
		return x ? x / Math.sin(x) : 1;
	}
	function sgn(x) {
		return x > 0 ? 1 : x < 0 ? -1 : 0;
	}
	function asin(x) {
		return x > 1 ? halfπ : x < -1 ? -halfπ : Math.asin(x);
	}
	function acos(x) {
		return x > 1 ? 0 : x < -1 ? π : Math.acos(x);
	}
	function asqrt(x) {
		return x > 0 ? Math.sqrt(x) : 0;
	}
	var projection = d3.geo.projection;

	function eckert3(λ, φ) {
		var k = Math.sqrt(π * (4 + π));
		return [ 2 / k * λ * (1 + Math.sqrt(1 - 4 * φ * φ / (π * π))), 4 / k * φ ];
	}
	eckert3.invert = function(x, y) {
		var k = Math.sqrt(π * (4 + π)) / 2;
		return [ x * k / (1 + asqrt(1 - y * y * (4 + π) / (4 * π))), y * k / 2 ];
	};
	(d3.geo.eckert3 = function() {
		return projection(eckert3);
	}).raw = eckert3;

})();

//custom implementation of d3_treshold which uses greaterThan (by using bisectorLeft instead of bisectorRight)
d3.scale.equal_threshold = function() {
  return d3_scale_equal_threshold([0.5], [0, 1]);
};

function d3_scale_equal_threshold(domain, range) {

  function scale(x) {
    if (x <= x) return range[d3.bisectLeft(domain, x)];
  }

  scale.domain = function(_) {
    if (!arguments.length) return domain;
    domain = _;
    return scale;
  };

  scale.range = function(_) {
    if (!arguments.length) return range;
    range = _;
    return scale;
  };

  scale.invertExtent = function(y) {
    y = range.indexOf(y);
    return [domain[y - 1], domain[y]];
  };

  scale.copy = function() {
    return d3_scale_threshold(domain, range);
  };

  return scale;
}
