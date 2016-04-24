;(function() {
	"use strict";
	owid.namespace("App.Views.Chart.MapTab");

	var MapControls = App.Views.Chart.Map.MapControls,
		TimelineControls = App.Views.Chart.Map.TimelineControls,
		owdProjections = App.Views.Chart.Map.Projections,
		Legend = App.Views.Chart.Map.Legend,
		ChartDataModel = App.Models.ChartDataModel;

	App.Views.Chart.MapTab = Backbone.View.extend({

		BORDERS_DISCLAIMER_TEXT: "Mapped on current borders",

		el: "#chart-view",
		dataMap: null,
		mapControls: null,
		legend: null,
		bordersDisclaimer: null,

		events: {},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			this.parentView = options.parentView;
			this.vardataModel = options.vardataModel;
			this.$tab = this.$el.find("#map-chart-tab");
			this.isAwake = false;
		},

		activate: function() {
			// HACK - the chart tab is still responsible for the footer info
			if (!this.parentView.chartTab.isAwake) {
				this.parentView.chartTab.once("tab-ready", function() {
					this.activate();
				}.bind(this))
				this.parentView.chartTab.activate();				
				return;
			}

			if (this.isAwake) {
				this.trigger("tab-ready");
				return;
			}

			this.mapControls = new MapControls( { dispatcher: this.dispatcher } );
			this.timelineControls = new TimelineControls( { dispatcher: this.dispatcher } );

			App.ChartModel.on("change", this.update, this);
			App.ChartModel.on("change-map", this.update, this);
			App.ChartModel.on("change-map-year", this.updateYearOnly, this);
			this.update();
			this.isAwake = true;
		},

		update: function() {
			this.mapConfig = App.ChartModel.get("map-config");

			// We need to wait for both datamaps to finish its setup and the variable data
			// to come in before the map can be fully rendered
			var self = this;
			function onMapReady() {
				self.vardataModel.ready(function(variableData) {
					self.receiveData(variableData);
				});
			}

			if (!this.dataMap)
				this.initializeMap(onMapReady);
			else
				onMapReady();
		},

		// Optimized method for updating the target year with the slider
		updateYearOnly: _.throttle(function() {
			this.vardataModel.ready(function(variableData) {
				this.mapData = this.transformData(variableData);
				this.applyColors(this.mapData, this.colorScale);
				this.dataMap.updateChoropleth(this.mapData, { reset: true });
				this.parentView.header.render();
			}.bind(this));
		}, 100),

		initializeMap: function(onMapReady) {
			var self = this;
			var defaultProjection = this.getProjection(this.mapConfig.projection);

			this.dataMap = new Datamap({
				element: $("#map-chart-tab").get(0),
				responsive: true,
				geographyConfig: {
					dataUrl: Global.rootUrl + "/build/js/data/world.ids.json",
					borderWidth: 0.3,
					borderColor: '#4b4b4b',
					highlightBorderColor: 'black',
					highlightBorderWidth: 0.2,
					highlightFillColor: '#FFEC38',
					popupTemplate: self.popupTemplateGenerator,
					hideAntarctica: true
				},
				fills: {
					defaultFill: '#8b8b8b'
				},
				setProjection: defaultProjection,
				done: onMapReady
			});

			// For maps earlier than 2011, display a disclaimer noting that data is mapped
			// on current rather than historical borders
			if (parseInt(self.mapConfig.minYear) <= 2011) {
				this.bordersDisclaimer = d3.select( ".border-disclaimer" );
				if (this.bordersDisclaimer.empty()) {
					this.bordersDisclaimer = d3.select(".datamap").append("text");
					this.bordersDisclaimer.attr("class", "border-disclaimer").text(this.BORDERS_DISCLAIMER_TEXT);
				}
			}
		},

		render: function() {
			var that = this;
			//fetch created dom
			this.$tab = $( "#map-chart-tab" );

		},

		show: function() {
			this.$el.show();
		},

		hide: function() {
			this.$el.hide();
		},

		popupTemplateGenerator: function(geo, data) {
			if (_.isEmpty(data)) return;

			//transform datamaps data into format close to nvd3 so that we can reuse the same popup generator
			var mapConfig = App.ChartModel.get( "map-config" ),
				propertyName = App.Utils.getPropertyByVariableId(App.ChartModel, mapConfig.variableId) || "y";

			var obj = {
				point: {
					time: data.year
				},
				series: [{
					key: geo.properties.name
				}]
			};
			obj.point[propertyName] = data.value;
			return ["<div class='hoverinfo nvtooltip'>" + owid.contentGenerator( obj, true ) + "</div>"];
		},

		onChartModelChange: function( evt ) {
			this.update();
		},


		/**
		 * Transforms raw variable data into datamaps format
		 * @param {Object} variableData - of the form { entities: [], values: [], years: [] }
		 * @return {Object} mapData - of the form { 'Country': { value: 120.11, year: 2006 }, ...}
		 */
		transformData: function(variableData) {
			var firstVariable = variableData.variables[this.mapConfig.variableId],
				years = firstVariable.years,
				values = firstVariable.values,
				entities = firstVariable.entities,
				entityKey = variableData.entityKey,
				targetYear = parseInt(this.mapConfig.targetYear),
				tolerance = parseInt(this.mapConfig.timeTolerance) || 1,
				mapData = {};

			if (this.mapConfig.mode === "no-interpolation")
				tolerance = 0;

			for (var i = 0; i < values.length; i++) {
				var year = years[i];
				if (year < targetYear-tolerance || year > targetYear+tolerance) 
					continue;

				// Make sure we use the closest year within tolerance (favoring later years)
				var current = mapData[entityName];
				if (current && Math.abs(current.year - targetYear) < Math.abs(year - targetYear))
					continue;


				// Transform entity name to match counterpart in world.ids.json
				// Covers e.g. Cote d'Ivoire -> Cote_d_Ivoire
				var entityName = entityKey[entities[i]].name.replace(/[ '&:\(\)\/]/g, "_");

				mapData[entityName] = {
					value: parseFloat(values[i]),
					year: years[i]
				};
			}

			this.minValue = _.min(mapData, function(d, i) { return d.value; }).value;
			this.maxValue = _.max(mapData, function(d, i) { return d.value; }).value;
			this.minToleranceYear = _.min(mapData, function(d, i) { return d.year; }).year;
			this.maxToleranceYear = _.max(mapData, function(d, i) { return d.year; }).year;
			this.variableName = firstVariable.name;


			// HACK (Mispy): Ideally these calculated values shouldn't go in mapConfig,
			// but for backwards compatibility it's easier to have them there.
			var rangeYears = owid.timeRangesToYears(this.mapConfig.timeRanges, years[0], years[years.length-1]);
			App.ChartModel.updateMapConfig("minYear", rangeYears[0], true);
			App.ChartModel.updateMapConfig("maxYear", rangeYears[rangeYears.length-1], true);


			return mapData;
		},

		applyColors: function(mapData, colorScale) {
			_.each(mapData, function(d, i) {
				d.color = colorScale(d.value);
			});
		},

		receiveData: function(variableData) {
			this.mapData = this.transformData(variableData);
			this.colorScale = this.makeColorScale();
			this.applyColors(this.mapData, this.colorScale);
			this.legend = this.makeLegend();

			// If we've changed the projection (i.e. zooming on Africa or similar) we need
			// to redraw the datamap before injecting new data
			var oldProjection = this.dataMap.options.setProjection,
				newProjection = this.getProjection(this.mapConfig.projection);

			var self = this;
			var updateMap = function() {
				self.dataMap.updateChoropleth(self.mapData, { reset: true });
				self.mapControls.render();
				self.timelineControls.render();
				self.trigger("tab-ready");
			};

			if (oldProjection === newProjection) {
				updateMap();
			} else {
				d3.selectAll("path.datamaps-subunit").remove();
				this.dataMap.options.setProjection = newProjection;
				this.dataMap.options.done = updateMap;
				this.dataMap.draw();
			}
		},

		makeColorScale: function() {
			var mapConfig = this.mapConfig;
			var colorScheme = owdColorbrewer.getColors(mapConfig);

			var colorScale,
				customValues = mapConfig.colorSchemeValues,
				automaticValues = mapConfig.colorSchemeValuesAutomatic;

			var categoricalScale = false;

			//use quantize, if we have numerica scale and not using automatic values, or if we're trying not to use automatic scale, but there no manually entered custom values
			if( !categoricalScale && ( automaticValues || (!automaticValues && !customValues) ) ) {
				//we have quantitave scale
				colorScale = d3.scale.quantize()
					.domain( [ this.minValue, this.maxValue ] );
			} else if( !categoricalScale && customValues && !automaticValues ) {
				//create threshold scale which divides data into buckets based on values provided
				colorScale = d3.scale.equal_threshold()
					.domain( customValues );
			} else {
/*				var keys = _.keys( keysArr );
				keys = keys.sort();
				colorScale = d3.scale.ordinal()
					.domain( _.keys( keysArr ) );*/
			}
			colorScale.range(colorScheme);

			return colorScale;
		},

		makeLegend: function() {
			var legend = this.legend || new Legend(),
				minValue = this.minValue,
				maxValue = this.maxValue,
				mapConfig = this.mapConfig,
				colorScale = this.colorScale;

			if (mapConfig.colorSchemeMinValue || mapConfig.colorSchemeValuesAutomatic) {
				legend.displayMinLabel(true);
			} else {
				legend.displayMinLabel(false);
			}

			var legendSize = mapConfig.legendStepSize || 20;
			legend.stepSizeWidth(legendSize);
			legend.labels(mapConfig.colorSchemeLabels);
			var legendOrientation = mapConfig.legendOrientation || "landscape";
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

			var legendData = { scheme: colorScale.range(), description: mapConfig.legendDescription || this.variableName };
			d3.select(".legend-wrapper").datum(legendData).call(legend);
			return legend;
		},

		getProjection: function( projectionName ) {
			var projections = owdProjections,
				newProjection = ( projections[ projectionName ] )? projections[ projectionName ]: projections.World;
			return newProjection;
		},

		onResize: function() {
			var map = d3.select(".datamaps-subunits");			
			if (!this.dataMap || map.empty())
				return;

			var viewports = {
				"World": { x: 0.525, y: 0.5, width: 1, height: 1 },
				"Africa": { x: 0.48, y: 0.70, width: 0.21, height: 0.38 },
				"N.America": { x: 0.49, y: 0.40, width: 0.19, height: 0.32 },
				"S.America": { x: 0.52, y: 0.815, width: 0.10, height: 0.26 },
				"Asia": { x: 0.49, y: 0.52, width: 0.22, height: 0.38 },
				"Australia": { x: 0.51, y: 0.77, width: 0.1, height: 0.12 },
				"Europe": { x: 0.54, y: 0.54, width: 0.05, height: 0.15 },
			};

			var viewport = viewports[App.ChartModel.get("map-config").projection];

			var options = this.dataMap.options,
				prefix = "-webkit-transform" in document.body.style ? "-webkit-" : "-moz-transform" in document.body.style ? "-moz-" : "-ms-transform" in document.body.style ? "-ms-" : "";

			var wrapper = d3.select( ".datamap" ),
				wrapperBoundingRect = wrapper.node().getBoundingClientRect(),
				wrapperWidth = wrapperBoundingRect.right - wrapperBoundingRect.left,
				wrapperHeight = wrapperBoundingRect.bottom - wrapperBoundingRect.top,
				mapBoundingRect = map.node().getBoundingClientRect(),
				mapBBox = map.node().getBBox(), // contains original, untransformed width+height
				mapWidth = mapBBox.width,
				mapHeight = mapBBox.height,
				mapX = wrapperBoundingRect.left + mapBBox.x + 1,
				mapY = wrapperBoundingRect.top + mapBBox.y + 1,
				viewportWidth = viewport.width*mapWidth,
				viewportHeight = viewport.height*mapHeight;

			//console.log("wrapperWidth " + wrapperWidth + " wrapperHeight " + wrapperHeight + " mapWidth " + mapWidth + " mapHeight " + mapHeight);

			// Adjust wrapperHeight to compensate for timeline controls
			var timelineControls = d3.select( ".map-timeline-controls" );
			if( !timelineControls.empty() ) {
				var controlsBoundingRect = timelineControls.node().getBoundingClientRect(),
					controlsHeight = controlsBoundingRect.bottom - controlsBoundingRect.top;
				wrapperHeight -= controlsHeight;
			}

			// Calculate scaling to match the viewport to the container while retaining aspect ratio
			var scaleFactor = Math.min(wrapperWidth/viewportWidth, wrapperHeight/viewportHeight),
				scaleStr = "scale(" + scaleFactor + ")";

			// Work out how to center the map accounting for the new scaling
			var newWidth = mapWidth*scaleFactor,
				newHeight = mapHeight*scaleFactor,
				wrapperCenterX = wrapperBoundingRect.left + wrapperWidth / 2,
				wrapperCenterY = wrapperBoundingRect.top + wrapperHeight / 2,
				newCenterX = mapX + (scaleFactor-1)*mapBBox.x + viewport.x*newWidth,
				newCenterY = mapY + (scaleFactor-1)*mapBBox.y + viewport.y*newHeight,
				newOffsetX = wrapperCenterX - newCenterX,
				newOffsetY = wrapperCenterY - newCenterY,
				translateStr = "translate(" + newOffsetX + "px," + newOffsetY + "px)";

			var matrixStr = "matrix(" + scaleFactor + ",0,0," + scaleFactor + "," + newOffsetX + "," + newOffsetY + ")";
			map.style(prefix + "transform", matrixStr);

			if( this.bordersDisclaimer && !this.bordersDisclaimer.empty() ) {
				var bordersDisclaimerEl = this.bordersDisclaimer.node(),
					bordersDisclaimerX = wrapperWidth - bordersDisclaimerEl.getComputedTextLength() - 10,
					bordersDisclaimerY = wrapperHeight - 10;
				this.bordersDisclaimer.attr( "transform", "translate(" + bordersDisclaimerX + "," + bordersDisclaimerY + ")" );
			}

			if( this.legend ) {
				this.legend.resize();
			}

			/*wrapper.on("mousemove", function() {
				var point = d3.mouse(this);
				var rect = map.node().getBoundingClientRect();
				var wrapRect = wrapper.node().getBoundingClientRect();
				var x = point[0] - (rect.left - wrapRect.left);
				var y = point[1] - (rect.top - wrapRect.top);
				console.log([x/newWidth, y/newHeight]);
			});*/
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
