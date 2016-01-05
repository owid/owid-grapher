;( function() {
	
	"use strict";

	var App = require( "./../../namespaces.js" ),
		MapControls = require( "./map/App.Views.Chart.Map.MapControls.js" ),
		TimelineControls = require( "./map/timeline/App.Views.Chart.Map.TimelineControls.js" ),
		owdProjections = require( "./map/App.Views.Chart.Map.Projections.js" ),
		Legend = require( "./map/App.Views.Chart.Map.Legend.js" ),
		ChartDataModel = require( "./../../models/App.Models.ChartDataModel.js" );

	App.Views.Chart.MapTab = Backbone.View.extend({

		$tab: null,
		dataMap: null,
		mapControls: null,
		legend: null,

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
				responsive: false,
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
							that.displayData( response.data );
						}
					} );
					that.mapDataModel.on( "error", function() {
						console.error( "Error loading map data." );
					} );
					that.update();
				}
			} );

			this.legend = new Legend();
			
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
					time: mapConfig.targetYear
				},
				series: [ {
					key: geo.properties.name
				} ]
			};
			obj.point[ propertyName ] = data.value;
			return [ "<div class='hoverinfo nvtooltip'>" + App.Utils.contentGenerator( obj, true ) + "</div>" ];
		},

		update: function() {
			
			var mapConfig = App.ChartModel.get( "map-config" );

			//construct dimension string
			var that = this,
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

		displayData: function( data ) {
			
			var that = this,
				mapConfig = App.ChartModel.get( "map-config" ),
				ordinalScale = false,
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
					ordinalScale = true;
				}
				keysArr[ latestTimeValue ] = true;

				//ids in world json are name countries with underscore (datamaps.js uses id for selector, so cannot have whitespace), also cover Cote d'Ivoire, Saint Martin (French_part) cases, also get rid of ampersands
				var key = d.key.replace( /[ '&:\(\)]/g, "_" );
				return { "key": key, "value": latestTimeValue };

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

			//

			//use quantize, if we have numerica scale and not using automatic values, or if we're trying not to use automatic scale, but there no manually entered custom values
			if( !ordinalScale && ( automaticValues || (!automaticValues && !customValues) ) ) {
				//we have quantitave scale
				colorScale = d3.scale.quantize()
					.domain( [ dataMin, dataMax ] );
			} else if( customValues && !automaticValues ) {
				//create threshold scale which divides data into buckets based on values provided 
				colorScale = d3.scale.threshold()
					.domain( customValues );
			} else {
				colorScale = d3.scale.ordinal()
					.domain( _.keys( keysArr ) );
			}
			colorScale.range( colorScheme );
			
			//need to encode colors properties
			var mapData = {},
				colors = [];
			latestData.forEach( function( d, i ) {
				var color = (ordinalScale)? colorScale( d.value ): colorScale( +d.value );
				mapData[ d.key ] = { "key": d.key, "value": d.value, "color": color };
				colors.push( color );
			} );

			this.legend.scale( colorScale );
			if( d3.select( ".legend-wrapper" ).empty() ) {
				d3.select( ".datamap" ).append( "g" ).attr( "class", "legend-wrapper map-legend-wrapper" );
			}
			var legendData = { scheme: colorScheme, description: mapConfig.legendDescription };
			d3.select( ".legend-wrapper" ).datum( legendData ).call( this.legend );
			//d3.select( ".datamap" ).datum( colorScheme ).call( this.legend );

			//update map
			//are we changing projections?
			var oldProjection = this.dataMap.options.setProjection,
				newProjection = this.getProjection( mapConfig.projection );
			if( oldProjection === newProjection ) {
				//projection stays the same, no need to redraw units
				//need to set all units to default color first, cause updateChopleth just updates new data leaves the old data for units no longer in dataset
				d3.selectAll( "path.datamaps-subunit" ).style( "fill", this.dataMap.options.fills.defaultFill );
				this.dataMap.updateChoropleth( mapData );
			} else {
				//changing projection, need to remove existing units, redraw everything and after done drawing, update data
				d3.selectAll( "path.datamaps-subunit" ).remove();
				this.dataMap.options.setProjection = newProjection;
				this.dataMap.draw();
				this.dataMap.options.done = function() {
					that.dataMap.updateChoropleth( mapData );
				};
			}
			
		},

		getProjection: function( projectionName ) {
			var projections = owdProjections,
				newProjection = ( projections[ projectionName ] )? projections[ projectionName ]: projections.World;
			return newProjection;
		},

		onResize: function() {
			if( this.dataMap ) {

				var map = d3.select( ".datamaps-subunits" );
				if( !map.empty() ) {

					//translate
					var wrapper = d3.select( ".datamap" ),
						wrapperBoundingRect = wrapper.node().getBoundingClientRect(),
						wrapperHeight = wrapperBoundingRect.bottom - wrapperBoundingRect.top,
						mapBoundingRect = map.node().getBoundingClientRect(),
						mapHeight = mapBoundingRect.bottom - mapBoundingRect.top;
					
					//compensate for possible 
					var timelineControls = d3.select( ".map-timeline-controls" );
					if( !timelineControls.empty() ) {
						var controlsBoundingRect = timelineControls.node().getBoundingClientRect(),
							controlsHeight = controlsBoundingRect.bottom - controlsBoundingRect.top;
						wrapperHeight -= controlsHeight;
					}

					//map might have already offset
					var mapOffset = mapBoundingRect.top - wrapperBoundingRect.top;
					wrapperHeight -= mapOffset;

					//compute necessary vertical offset
					var	mapOffsetY = (wrapperHeight - mapHeight) / 2;
					
					//scaling
					var options = this.dataMap.options,
						prefix = "-webkit-transform" in document.body.style ? "-webkit-" : "-moz-transform" in document.body.style ? "-moz-" : "-ms-transform" in document.body.style ? "-ms-" : "",
						newsize = options.element.clientWidth,
						oldsize = d3.select( options.element).select("svg").attr("data-width"),
						scale = (newsize / oldsize);
						
					map.style(prefix + "transform", "scale(" + scale + ") translate(0," + mapOffsetY/scale + "px)" );
					
				}

			}
			
			if( this.legend ) {
				this.legend.resize();
			}

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