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
			this.mapControls = new MapControls( { dispatcher: options.dispatcher } );
			this.timelineControls = new TimelineControls( { dispatcher: options.dispatcher } );

			//init map only if the map tab displayed
			var that = this;
			$( "[data-toggle='tab'][href='#map-chart-tab']" ).on( "shown.bs.tab", function( evt ) {
				that.display();
			} );

		},

		display: function() {
			//render only if no map yet
			if( !this.dataMap ) {
				this.render();
			} else {
				//map exists, so only resize it to current dimensions, (in case window was resized while on other tab)
				this.onResize();
			}
		},

		render: function() {

			var that = this;
			//fetch created dom
			this.$tab = $( "#map-chart-tab" );

			var mapConfig = App.ChartModel.get( "map-config" ),
				defaultProjection = this.getProjection( mapConfig.projection );

			this.dataMap = new Datamap( {
				width: that.$tab.width(),
				height: that.$tab.height(),
				responsive: true,
				element: document.getElementById( "map-chart-tab" ),
				geographyConfig: {
					dataUrl: Global.rootUrl + "/build/js/data/world.ids.json",
					borderWidth: 0.3,
					borderColor: '#4b4b4b',
					highlightBorderColor: 'black',
					highlightBorderWidth: 0.2,
					highlightFillColor: '#FFEC38',
					popupTemplate: that.popupTemplateGenerator,
					hideAntarctica: true
				},
				fills: {
					defaultFill: '#8b8b8b'
					//defaultFill: '#DDDDDD'
				},
				setProjection: defaultProjection,
				//wait for json to load before loading map data
				done: function() {
					that.mapDataModel = new ChartDataModel();
					that.mapDataModel.on( "sync", function( model, response ) {
						if( response.data ) {
							that.displayData( response.data, response.variableName );
						}
					} );
					that.mapDataModel.on( "error", function() {
						console.error( "Error loading map data." );
					} );
					that.update();
				}
			} );

			this.legend = new Legend();

			//border disclaimer - only displayed Add only for all maps displaying years 2011 and earlier
			if( mapConfig.minYear <= 2011 ) {
				this.bordersDisclaimer = d3.select( ".border-disclaimer" );
				if( this.bordersDisclaimer.empty() ) {
					this.bordersDisclaimer = d3.select( ".datamap" ).append( "text" );
					this.bordersDisclaimer.attr( "class", "border-disclaimer" ).text( this.BORDERS_DISCLAIMER_TEXT );
				}
			}

			App.ChartModel.on( "change", this.onChartModelChange, this );
			App.ChartModel.on( "change-map", this.onChartModelChange, this );
			App.ChartModel.on( "resize", this.onChartModelResize, this );

			//var lazyResize = _.debounce( $.proxy( this.onResize, this ), 250 );
			//nv.utils.windowResize( lazyResize );
			this.onResize();

		},

		show: function() {
			this.$el.show();
		},

		hide: function() {
			this.$el.hide();
		},

		onChartModelChange: function( evt ) {

			this.update();

		},

		popupTemplateGenerator: function( geo, data ) {
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

		update: function() {

			//construct dimension string
			var that = this,
				mapConfig = App.ChartModel.get( "map-config" ),
				chartTime = App.ChartModel.get( "chart-time" ),
				variableId = mapConfig.variableId,
				targetYear = mapConfig.targetYear,
				mode = mapConfig.mode,
				tolerance = mapConfig.timeTolerance,
				dimensions = [{ name: "Map", property: "map", variableId: variableId, targetYear: targetYear, mode: mode, tolerance: tolerance }],
				dimensionsString = JSON.stringify( dimensions ),
				chartType = 9999,
				selectedCountries = App.ChartModel.get( "selected-countries" ),
				//display all countries on the map
				selectedCountriesIds = [];
				//selectedCountriesIds = _.map( selectedCountries, function( v ) { return (v)? +v.id: ""; } );

			this.mapControls.render();
			this.timelineControls.render();

			var dataProps = { "dimensions": dimensionsString, "chartId": App.ChartModel.get( "id" ), "chartType": chartType, "selectedCountries": selectedCountriesIds, "chartTime": chartTime, "cache": App.ChartModel.get( "cache" ), "groupByVariables": App.ChartModel.get( "group-by-variables" )  };
			this.mapDataModel.fetch( { data: dataProps } );

			return this;
		},

		displayData: function( data, variableName ) {

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

				//ids in world json are name countries with underscore (datamaps.js uses id for selector, so cannot have whitespace), also cover Cote d'Ivoire, Saint Martin (French_part) cases, also get rid of ampersands, and slash
				var key = d.key.replace( /[ '&:\(\)\/]/g, "_" );
				return { "key": key, "value": latestTimeValue, "time": d.time };

			} );

			//are we using colorbrewer schemes
			var colorScheme;
			if( mapConfig.colorSchemeName !== "custom" ) {
				colorScheme = ( owdColorbrewer[ mapConfig.colorSchemeName ] && owdColorbrewer[ mapConfig.colorSchemeName ][ "colors" ][ mapConfig.colorSchemeInterval ] )? owdColorbrewer[ mapConfig.colorSchemeName ][ "colors" ][ mapConfig.colorSchemeInterval ]: [];
			} else if( mapConfig.colorSchemeName ) {
				colorScheme = mapConfig.customColorScheme;
			}

			//need to create color scheme
			var colorScale,
				//do we have custom values for intervals
				customValues = (mapConfig.colorSchemeValues)? mapConfig.colorSchemeValues: false,
				automaticValues = mapConfig.colorSchemeValuesAutomatic;

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
				var keys = _.keys( keysArr );
				keys = keys.sort();
				colorScale = d3.scale.ordinal()
					.domain( _.keys( keysArr ) );
				console.log( "keys", keys );
			}
			colorScale.range( colorScheme );

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

			//update map
			//are we changing projections?
			var oldProjection = this.dataMap.options.setProjection,
				newProjection = this.getProjection( mapConfig.projection );
			if( oldProjection === newProjection ) {
				//projection stays the same, no need to redraw units
				//need to set all units to default color first, cause updateChopleth just updates new data leaves the old data for units no longer in dataset
				d3.selectAll( "path.datamaps-subunit" ).transition().style( "fill", this.dataMap.options.fills.defaultFill );
				this.dataMap.updateChoropleth( mapData );
				this.onResize();
			} else {
				//changing projection, need to remove existing units, redraw everything and after done drawing, update data
				d3.selectAll( "path.datamaps-subunit" ).remove();
				this.dataMap.options.setProjection = newProjection;
				this.dataMap.draw();
				this.dataMap.options.done = function() {
					that.dataMap.updateChoropleth( mapData );
					that.onResize();
				};
			}
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
				"World": { x: 0.5, y: 0.5, width: 1, height: 1 },
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

			// First, undo any existing scale/translation and get our reference points
			//console.log(map.node().getBoundingClientRect().left);
			map.style(prefix + "transform", "scale(1) translate(0px,0px)");
			//console.log(map.node().getBoundingClientRect().left);

			var wrapper = d3.select( ".datamap" ),
				wrapperBoundingRect = wrapper.node().getBoundingClientRect(),
				wrapperWidth = wrapperBoundingRect.right - wrapperBoundingRect.left,
				wrapperHeight = wrapperBoundingRect.bottom - wrapperBoundingRect.top,
				mapBoundingRect = map.node().getBoundingClientRect(),
				mapWidth = mapBoundingRect.right - mapBoundingRect.left,
				mapHeight = mapBoundingRect.bottom - mapBoundingRect.top,
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

			map.style(prefix + "transform", scaleStr + " translate(0px,0px)");

			// Now that we've scaled the map, we can get our new dimensions and center it
			var newBoundingRect = map.node().getBoundingClientRect(),
				newWidth = newBoundingRect.right - newBoundingRect.left,
				newHeight = newBoundingRect.bottom - newBoundingRect.top,
				wrapperCenterX = wrapperBoundingRect.left + wrapperWidth / 2,
				wrapperCenterY = wrapperBoundingRect.top + wrapperHeight / 2,
				newCenterX = newBoundingRect.left + viewport.x*newWidth,
				newCenterY = newBoundingRect.top + viewport.y*newHeight,
				newOffsetX = wrapperCenterX - newCenterX,
				newOffsetY = wrapperCenterY - newCenterY,
				translateStr = "translate(" + newOffsetX + "px," + newOffsetY + "px)";

			map.style(prefix + "transform", "matrix(" + scaleFactor + ",0,0," + scaleFactor + "," + newOffsetX + "," + newOffsetY);

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

		onChartModelResize: function() {
			this.onResize();
		}

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
