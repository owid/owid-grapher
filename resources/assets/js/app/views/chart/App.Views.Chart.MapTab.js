;( function() {

	"use strict";

	var App = require( "./../../namespaces.js" ),
		MapControls = require( "./map/App.Views.Chart.Map.MapControls.js" ),
		TimelineControls = require( "./map/timeline/App.Views.Chart.Map.TimelineControls.js" ),
		owdProjections = require( "./map/App.Views.Chart.Map.Projections.js" ),
		Legend = require( "./map/App.Views.Chart.Map.Legend.js" ),
		ChartDataModel = require( "./../../models/App.Models.ChartDataModel.js" );

	App.Views.Chart.MapTab = Backbone.View.extend({

		BORDERS_DISCLAIMER_TEXT: "Mapped on current borders",

		$tab: null,
		dataMap: null,
		mapControls: null,
		legend: null,
		bordersDisclaimer: null,

		events: {},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			this.parentView = options.parentView;
			this.mapControls = new MapControls( { dispatcher: options.dispatcher } );
			this.timelineControls = new TimelineControls( { dispatcher: options.dispatcher } );

			App.ChartModel.on("change", this.update, this);
			App.ChartModel.on("change-map", this.update, this);
			App.ChartModel.on("resize", this.onResize, this);

			this.update();
		},

		update: function() {
			this.mapConfig = App.ChartModel.get("map-config");
			// Preload the variable data for all years and all countries
			if (!this.variableData || this.variableData.id != this.mapConfig.variableId) {
				this.variableData = null;
				this.dataRequest = $.getJSON("/data/variable/" + this.mapConfig.variableId);
			}

			// We can start datamaps going before we actually have any data to show
			// if (this.parentView.activeTab...)			
			if (!this.dataMap)
				this.initializeMap();
			else {
				var self = this;
				this.dataRequest.done(function(data) {
					self.receiveData(data);
				});
			}
		},

		initializeMap: function() {
			var self = this;
			var defaultProjection = this.getProjection(this.mapConfig.projection);

			this.dataMap = new Datamap( {
				element: $("#map-chart-tab").get(0),
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
				done: function() {
					self.dataRequest.done(function(data) {
						self.receiveData(data);
					});
				}
			} );

			this.legend = new Legend();

			// For maps earlier than 2011, display a disclaimer noting that data is mapped
			// on current rather than historical borders
			if (self.mapConfig.minYear <= 2011) {
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

			this.mapControls.render();
			this.timelineControls.render();
		},

		show: function() {
			this.$el.show();
		},

		hide: function() {
			this.$el.hide();
		},

		popupTemplateGenerator: function( geo, data ) {
			console.log(data);
			if (_.isEmpty(data)) return;

			//transform datamaps data into format close to nvd3 so that we can reuse the same popup generator
			var mapConfig = App.ChartModel.get( "map-config" ),
				propertyName = App.Utils.getPropertyByVariableId( App.ChartModel, mapConfig.variableId );
			if( !propertyName ) {
				propertyName = "y";
			}
			var obj = {
				point: {
					time: data.time
					//time: mapConfig.targetYear
				},
				series: [ {
					key: geo.properties.name
				} ]
			};
			obj.point[ propertyName ] = data.value;
			return [ "<div class='hoverinfo nvtooltip'>" + App.Utils.contentGenerator( obj, true ) + "</div>" ];
		},

		onChartModelChange: function( evt ) {
			this.update();
		},


		/**
		 * Transforms raw variable data into datamaps format
		 * @param {Object} variableData - of the form { entities: [], values: [], years: [] }
		 * @return {Object} mapData - of the form { 'Country': { value: 120.11 }, ...}
		 */
		transformData: function(variableData) {
			var years = variableData.years,
				values = variableData.values,
				entities = variableData.entities,
				entityKey = variableData.entityKey,
				targetYear = parseInt(this.mapConfig.targetYear),
				tolerance = parseInt(this.mapConfig.tolerance) || 1,
				mapData = {};

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
				var entityName = entityKey[entities[i]].replace(/[ '&:\(\)\/]/g, "_");

				mapData[entityName] = {
					value: values[i],
					year: years[i]
				};
			}

			return mapData;
		},

		receiveData: function(variableData) {
			//var mapConfig = App.ChartModel.get("map-config");
			this.variableData = variableData;
			var mapData = this.transformData(variableData);

			// Apply colors to the transformed data
			var colorScale = this.makeColorScale();
			_.each(mapData, function(d, i) {
				d.color = colorScale(d.value);
			});

			d3.selectAll( "path.datamaps-subunit" ).transition().style( "fill", this.dataMap.options.fills.defaultFill );
			this.dataMap.updateChoropleth(mapData, { reset: true });
			this.onResize();
			return;
			//var dataForYear = owid.dataForYear(data, mapConfig.targetYear, mapConfig.tolerance);


			var that = this,
				mapConfig = App.ChartModel.get( "map-config" ),
				categoricalScale = false,
				keysArr =[],
				dataMin = Infinity,
				dataMax = -Infinity;

			//need to extract latest time
			var latestData = data.map( function( d, i ) {

				var values = d.values,
					latestTimeValue = ( values && values.length )? values[ values.length - 1]: 0;

				//also get min max values, could use d3.min, d3.max once we have all values, but this probably saves some time
				dataMin = Math.min( dataMin, latestTimeValue );
				dataMax = Math.max( dataMax, latestTimeValue );

				//is some of the values is not number, consider this qualitative variable and use scale
				if( isNaN( latestTimeValue ) ) {
					categoricalScale = true;
				}
				keysArr[ latestTimeValue ] = true;

				return { "key": key, "value": latestTimeValue, "time": d.time };

			} );


			//need to encode colors properties
			var mapData = {},
				colors = [],
				mapMin = Infinity,
				mapMax = -Infinity;

			latestData.forEach( function( d, i ) {
				var color = (categoricalScale)? colorScale( d.value ): colorScale( +d.value );
				mapData[ d.key ] = { "key": d.key, "value": d.value, "color": color, "time": d.time };
				//console.log( "d.key", d.key, d.value, color );
				colors.push( color );
				mapMin = Math.min( mapMin, d.value );
				mapMax = Math.max( mapMax, d.value );
			} );

			//create legend
			this.legend = this.setupLegend();
			this.legend.scale( colorScale );
			//see if we have minimal value in map config
			if( !isNaN( mapConfig.colorSchemeMinValue ) ) {
				mapMin = mapConfig.colorSchemeMinValue;
			}
			this.legend.minData( mapMin );
			this.legend.maxData( mapMax );
			if( d3.select( ".legend-wrapper" ).empty() ) {
				d3.select( ".datamap" ).append( "g" ).attr( "class", "legend-wrapper map-legend-wrapper" );
			}

			var legendData = { scheme: colorScheme, description: ( mapConfig.legendDescription )? mapConfig.legendDescription: variableName };
			d3.select( ".legend-wrapper" ).datum( legendData ).call( this.legend );

			window.mapData = mapData;

			//update map
			//are we changing projections?
			var oldProjection = this.dataMap.options.setProjection,
				newProjection = this.getProjection( mapConfig.projection );
			if( oldProjection === newProjection ) {
				//projection stays the same, no need to redraw units
				//need to set all units to default color first, cause updateChopleth just updates new data leaves the old data for units no longer in dataset
				d3.selectAll( "path.datamaps-subunit" ).transition().style( "fill", this.dataMap.options.fills.defaultFill );
				this.dataMap.updateChoropleth( mapData, { reset: true } );
				this.onResize();
			} else {
				//changing projection, need to remove existing units, redraw everything and after done drawing, update data
				d3.selectAll( "path.datamaps-subunit" ).remove();
				this.dataMap.options.setProjection = newProjection;
				this.dataMap.draw();
				this.dataMap.options.done = function() {
					that.dataMap.updateChoropleth( mapData, { reset: true } );
					that.onResize();
				};
			}

			this.trigger("tab-ready");
		},

		makeColorScale: function() {
			var mapConfig = App.ChartModel.get("map-config");

			var colorScheme;						
			if (mapConfig.colorSchemeName === "custom") {
				colorScheme = mapConfig.customColorScheme;
			} else {
				// Non-custom, using a predefined colorbrewer interval
				var brewer = owdColorbrewer[mapConfig.colorSchemeName];				
				colorScheme = (brewer && brewer.colors[mapConfig.colorSchemeInterval]) || [];

				if (_.isEmpty(colorScheme))
					console.warn("Invalid color scheme + interval: " + mapConfig.colorSchemeName + " " + mapConfig.colorSchemeInterval);
			}

			var colorScale,
				customValues = mapConfig.colorSchemeValues,
				automaticValues = mapConfig.colorSchemeValuesAutomatic;

			var categoricalScale = false;

			//use quantize, if we have numerica scale and not using automatic values, or if we're trying not to use automatic scale, but there no manually entered custom values
			if( !categoricalScale && ( automaticValues || (!automaticValues && !customValues) ) ) {
				//we have quantitave scale
				colorScale = d3.scale.quantize()
					.domain( [ dataMin, dataMax ] );
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
			colorScale.range( colorScheme );

			return colorScale;
		},

		setupLegend: function() {

			var legend = ( !this.legend )? new Legend(): this.legend,
				mapConfig = App.ChartModel.get( "map-config" );

			//see if we display minimal value in legend
			if( mapConfig.colorSchemeMinValue || mapConfig.colorSchemeValuesAutomatic ) {
				legend.displayMinLabel( true );
			} else {
				//lowest value isn't visible for not automatic scale with minimal value
				legend.displayMinLabel( false );
			}

			//size of legend square
			var legendSize = ( mapConfig.legendStepSize )? mapConfig.legendStepSize: 20;
			legend.stepSizeWidth( legendSize );

			//custom values for labels?
			legend.labels( mapConfig.colorSchemeLabels );

			//custom legend orientation
			var legendOrientation = ( mapConfig.legendOrientation )? mapConfig.legendOrientation: "landscape";
			legend.orientation( legendOrientation );

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
				"Europe": { x: 0.56, y: 0.54, width: 0.15, height: 0.30 },
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

	module.exports = App.Views.Chart.MapTab;

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
