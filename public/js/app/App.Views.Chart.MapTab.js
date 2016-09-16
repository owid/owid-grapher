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
		changes.track(chart.display, 'renderWidth renderHeight activeTab');

		var dataMap, bordersDisclaimer, colorScale;
		var svg, tabNode, svgNode, tabBounds, svgBounds, offsetY, availableWidth, availableHeight;

		var dispatcher = _.clone(Backbone.Events),
			mapControls = new MapControls({ dispatcher: dispatcher }),
			timelineControls = new TimelineControls({ dispatcher: dispatcher }),
			legend = new Legend();

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
				chart.urlBinder.updateCountryParam();
			});
		}

		function onMapHover(ev) {
			chart.tooltip.fromMap(ev, ev.target);
		}

		function onMapHoverStop(ev) {
			chart.tooltip.hide();
		}

		function calculateBounds() {
			if (!changes.any('renderWidth renderHeight activeTab'))
				return;

			svgNode = chart.$('svg').get(0);
			svgBounds = chart.getBounds(svgNode);
			tabNode = chart.$(".tab-pane.active").get(0);
			tabBounds = chart.getBounds(tabNode);
			offsetY = tabBounds.top - svgBounds.top;
			availableWidth = tabBounds.right - tabBounds.left;
			availableHeight = tabBounds.bottom - tabBounds.top;

			// Adjust availableHeight to compensate for timeline controls
			var timelineControls = chart.$(".map-timeline-controls").get(0);
			if (timelineControls) {
				var controlsBoundingRect = chart.getBounds(timelineControls),
					controlsHeight = controlsBoundingRect.bottom - controlsBoundingRect.top;
				availableHeight -= controlsHeight;
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
					highlightFillColor: '#8b8b8b',
					highlightBorderWidth: 3,
					highlightBorderColor: '#FFEC38',
					popupOnHover: false,
					hideAntarctica: true
				},
				fills: {
					defaultFill: '#8b8b8b'
				},
				setProjection: owdProjections.World
			});
			mapTab.dataMap = dataMap;

			// HACK (Mispy): Workaround for the fact that datamaps insists on creating
			// its own SVG element instead of injecting into an existing one.
			$oldSvg.children().appendTo($("svg.datamap"));
			$oldSvg.remove();
			svg = d3.select('svg.datamap');

			chart.$('g.datamaps-subunits').on('click path', onMapClick);
			chart.$('g.datamaps-subunits').on('mouseenter path', onMapHover);
			chart.$('g.datamaps-subunits').on('mouseleave path', onMapHoverStop);
		}

		function updateColorScale() {
			var colorScheme = owdColorbrewer.getColors(chart.map.attributes),
				variable = chart.map.getVariable(),
				showOnlyRelevant = chart.map.showOnlyRelevantLegend(),
				customValues = chart.map.get("colorSchemeValues"),
				automaticValues = chart.map.get("colorSchemeValuesAutomatic"),
				categoricalScale = variable && !variable.isNumeric,
				minValue = chart.map.getMinValue(),
				maxValue = chart.map.getMaxValue();

			//use quantize, if we have numerica scale and not using automatic values, or if we're trying not to use automatic scale, but there no manually entered custom values
			if (!categoricalScale && (automaticValues || (!automaticValues && !customValues))) {
				//we have quantitave scale
				colorScale = d3.scale.quantize().domain([minValue, maxValue]);
			} else if (!categoricalScale && customValues && !automaticValues) {
				//create threshold scale which divides data into buckets based on values provided
				colorScale = d3.scale.equal_threshold().domain(customValues);
			} else {
				colorScale = d3.scale.ordinal().domain(variable.uniqueValues);					
			}
			colorScale.range(colorScheme);

			if (showOnlyRelevant) {
				// Only show the colors that are actually on the map right now
				var values = _.sortBy(_.uniq(_.map(chart.mapdata.currentValues, function(d) { return d.value; })));
				colorScheme = _.map(values, function(v) { return colorScale(v); });
				colorScale.domain(values);
				colorScale.range(colorScheme);
			}				

			applyColors(chart.mapdata.currentValues, colorScale);
		}

		function applyColors(mapData, colorScale) {
			_.each(mapData, function(d, i) {
				d.color = colorScale(d.value);
				d.highlightFillColor = d.color;
			});
		}

		function updateLegend() {
			var minValue = chart.map.getMinValue(),
				maxValue = chart.map.getMaxValue(),
				mapConfig = chart.map.attributes,
				variable = chart.map.getVariable();

			if (mapConfig.colorSchemeMinValue || mapConfig.colorSchemeValuesAutomatic) {
				legend.displayMinLabel(true);
			} else {
				legend.displayMinLabel(false);
			}

			var unitsString = chart.model.get("units"),
				units = !_.isEmpty(unitsString) ? $.parseJSON(unitsString) : {},
				yUnit = _.findWhere(units, { property: 'y' });
			legend.unit(yUnit);
			legend.labels(mapConfig.colorSchemeLabels);

			var legendOrientation = mapConfig.legendOrientation || "portrait";
			legend.orientation(legendOrientation);
			legend.scale(colorScale);

			// Allow min value to overridden by config
			if (!isNaN(mapConfig.colorSchemeMinValue)) {
				minValue = mapConfig.colorSchemeMinValue;
			}
			legend.minData(minValue);
			legend.maxData(maxValue);
			if (d3.select(".legend-wrapper").empty()) {
				d3.select(".datamap").append("g").attr("class", "legend-wrapper map-legend-wrapper");
			}

			var legendData = { scheme: colorScale.range(), description: mapConfig.legendDescription || variable.name };
			d3.select(".legend-wrapper").datum(legendData).call(legend);
		}

		// Transforms the datamaps SVG to fit the container and focus a particular region if needed
		function updateViewport() {
			if (!changes.any('renderWidth renderHeight projection activeTab')) return;

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
				tabCenterX = tabBounds.left + availableWidth / 2,
				tabCenterY = tabBounds.top + availableHeight / 2,
				newCenterX = mapX + (scaleFactor-1)*mapBBox.x + viewport.x*newWidth,
				newCenterY = mapY + (scaleFactor-1)*mapBBox.y + viewport.y*newHeight,
				newOffsetX = tabCenterX - newCenterX,
				newOffsetY = tabCenterY - newCenterY,
				translateStr = "translate(" + newOffsetX + "px," + newOffsetY + "px)";

			var matrixStr = "matrix(" + scaleFactor + ",0,0," + scaleFactor + "," + newOffsetX + "," + newOffsetY + ")";
			map.attr('transform', matrixStr);
		}

		mapTab.activate = function() {
			chart.$('.chart-preloader').show();
		};

		function updateMapBackground() {
			if (changes.any('activeTab')) {
				svg.insert("rect", "*")
					.attr("class", "map-bg")
					.attr("x", 0).attr("y", 0);
			}

			if (changes.any('renderWidth renderHeight activeTab')) {
				svg.select(".map-bg")
					.attr("y", tabBounds.top - svgBounds.top)
					.attr("width", tabBounds.width)
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

			if (changes.any('renderWidth renderHeight')) {
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
			d3.selectAll(".datamaps-subunits, .border-disclaimer, .legend-wrapper, .map-bg").remove();			
			$("svg").removeClass("datamap");
			dataMap = null;
			changes.done();
		};

		mapTab.render = function() {
			chart.mapdata.update();
			if (!changes.start()) return;
			console.log('mapTab.render');

			if (!chart.map.getVariable()) {
				chart.handleError("No variable selected for map.", false);
				return;
			}

			initializeMap();
			if (!changes.only('targetYear')) {
				mapControls.render();
				timelineControls.render();				
			}
			calculateBounds();
			updateColorScale();
			updateMapBackground();
			updateBorderDisclaimer();
			updateProjection();
			updateViewport();
			updateLegend();

			dataMap.updateChoropleth(chart.mapdata.currentValues, { reset: true });
			dataMap.options.data = chart.mapdata.currentValues;
			d3.selectAll("svg.datamap").transition().each("end", function() {
				chart.dispatch.renderEnd();
			});

			changes.done();
			chart.$('.chart-preloader').hide();
		};

		return mapTab;
	};

	App.Views.Chart.MapTab = owid.View.extend({
		el: "#chart",
		dataMap: null,
		mapControls: null,
		legend: null,
		bordersDisclaimer: null,
		events: {
		},

		initialize: function(chart) {
			$tab = $el.find("#map-chart-tab");
		},


		update: function(callback) {			

			// We need to wait for both datamaps to finish its setup and the variable data
			// to come in before the map can be fully rendered
			var onMapReady = function() {
				$(".chart-inner").attr("style", "");

				chart.data.ready(function() {
					render();
				}.bind(this));				
			}.bind(this);
		},

		// Optimized method for updating the target year with the slider
		updateYearOnly: _.throttle(function() {
			chart.data.ready(function() {
				mapData = transformData();
				applyColors(mapData, colorScale);
				dataMap.updateChoropleth(mapData, { reset: true });
				// HACK (Mispy): When changing to a year without data for a country, need to do this
				// to get the right highlightFillColor.
				dataMap.options.data = mapData;
				chart.header.render();
				if (chart.map.showOnlyRelevantLegend()) {
					// HACK (Mispy): We really need to refactor the map legend into a proper view
					colorScale = makeColorScale();
					legend.scale(colorScale);
					var legendData = { scheme: colorScale.range(), description: chart.map.get("legendDescription") || variableName };
					d3.select(".legend-wrapper").datum(legendData).call(legend);
				}
			}.bind(this));
		}, 100),

		initializeMap: function(onMapReady) {
			onMapReady();

			// Set the post-initial-render defaults
			var mapConfig = chart.map.attributes;
			chart.map.set({
				targetYear: mapConfig.defaultYear || mapConfig.targetYear,
				projection: mapConfig.defaultProjection || mapConfig.projection
			});
		},

		render: function() {
			try {
				mapData = transformData();
				if (!mapData) return;				
				colorScale = makeColorScale();
				applyColors(mapData, colorScale);

				// If we've changed the projection (i.e. zooming on Africa or similar) we need
				// to redraw the datamap before injecting new data
				var oldProjection = dataMap.options.setProjection,
					newProjection = owdProjections[chart.map.get("projection")];

				var self = this;
				var updateMap = function() {
					self.dataMap.updateChoropleth(self.mapData, { reset: true });
					d3.selectAll("svg.datamap").transition().each("end", function() {
						chart.dispatch.renderEnd();
					});
					self.mapControls.render();
					self.timelineControls.render();
					self.onResize();
					chart.header.changes.track(self, 'mapData');
					chart.header.render();
					$('.chart-preloader').hide();
				};

				if (oldProjection === newProjection) {
					updateMap();
				} else {
					d3.selectAll("path.datamaps-subunit").remove();
					dataMap.options.setProjection = newProjection;
					dataMap.options.done = updateMap;
					dataMap.draw();
				}				
			} catch (err) {
				chart.handleError(err);
			}
		},
	});
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
