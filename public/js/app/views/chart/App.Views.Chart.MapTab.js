;( function() {
	
	"use strict";

	App.Views.Chart.MapTab = Backbone.View.extend({

		COLOR_SCHEME: [ "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f", "#3f007d" ],

		dataMap: null,
		legend: null,

		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;

			//init map only if the map tab displayed
			var that = this;
			$( "[data-toggle='tab'][href='#map-chart-tab']" ).on( "shown.bs.tab", function( evt ) {
				that.render();
			} );
			//return this.render();
		
		},

		render: function() {

			this.dataMap = new Datamap( {
				element: document.getElementById( "map-chart-tab" ),
				geographyConfig: {
					dataUrl: Global.rootUrl + "/js/data/world.ids.json",
					popupTemplate: function(geo, data) {
							return [ "<div class='hoverinfo'><strong>","Number of things in " + geo.properties.name, ": " + data.value, "</strong></div>" ].join("");
						}
				}
			} );

			this.legend = d3.select( ".datamap" ).append( "g" )
				.attr( "id", "colorBar" )
				.attr( "class", "colorbar" );

			this.legend.append( "rect" )
				.attr( "id", "gradientRect" )
				.attr( "width", 200)
				.attr( "height", 50)
				.style( "fill", "url(#gradient)" );

			var that = this;
			this.mapDataModel = new App.Models.ChartDataModel();
			this.mapDataModel.on( "sync", function( model, response ) {
				if( response.data ) {
					that.displayData( response.data );
				}
			} );
			this.mapDataModel.on( "error", function() {
				console.error( "Error loading map data." );
			} );
			App.ChartModel.on( "change", this.onChartModelChange, this );

			this.update();

		},

		onChartModelChange: function( evt ) {

			this.update();

		},

		update: function() {
			
			//construct dimension string
			var that = this,
				mapConfig = App.ChartModel.get( "map-config" ),
				variableId = mapConfig.variableId,
				targetYear = mapConfig.targetYear,
				mode = mapConfig.mode,
				tolerance = mapConfig.tolerance,
				dimensions = [{ name: "Map", property: "map", variableId: variableId, targetYear: targetYear, mode: mode, tolerance: tolerance }],
				chartTime = App.ChartModel.get( "chart-time" ),
				dimensionsString = JSON.stringify( dimensions ),
				chartType = 9999,
				selectedCountries = App.ChartModel.get( "selected-countries" ),
				selectedCountriesIds = _.map( selectedCountries, function( v ) { return (v)? +v.id: ""; } );

			var dataProps = { "dimensions": dimensionsString, "chartId": App.ChartModel.get( "id" ), "chartType": chartType, "selectedCountries": selectedCountriesIds, "chartTime": chartTime, "cache": App.ChartModel.get( "cache" ), "groupByVariables": App.ChartModel.get( "group-by-variables" )  };

			this.mapDataModel.fetch( { data: dataProps } );

			return this;
		},

		displayData: function( data ) {
			//debugger;
			var dataMin = Infinity,
				dataMax = -Infinity;

			//need to extract latest time
			var latestData = data.map( function( d, i ) {

				var values = d.values,
					latestTimeValue = ( values && values.length )? values[ values.length - 1]: 0;

				//also get min max values, could use d3.min, d3.max once we have all values, but this probably saves some time
				dataMin = Math.min( dataMin, latestTimeValue );
				dataMax = Math.max( dataMax, latestTimeValue );

				//ids in world json are name countries with underscore (datamaps.js uses id for selector, so cannot have whitespace)
				return { "key": d.key.replace( " ", "_" ), "value": latestTimeValue };

			} );

			//need to create color scheme
			var colorScale = d3.scale.quantize()
				.domain( [ dataMin, dataMax ] )
				.range( this.COLOR_SCHEME );

			//need to encode colors properties
			var mapData = {};
			latestData.forEach( function( d, i ) {
				mapData[ d.key ] = { "key": d.key, "value": d.value, "color": colorScale( d.value ) };
			} );

			//TODO - somehow need to clear the existing data ( so that if removed country, it's removed from map), probably do d3.select on map units and set default color?
			//update map
			this.dataMap.updateChoropleth( mapData );

			//update legend
			this.updateGradient( this.COLOR_SCHEME, "gradient");

		},

		updateGradient: function( palette, gradientId ) {
			d3.select( ".datamap" )
				.append( "linearGradient" )
				.attr( "id", gradientId)
					.attr( "gradientUnits", "userSpaceOnUse")
					.attr( "x1", 0)
					.attr( "y1", 0)
					.attr( "x2", 200)
					.attr( "y2", 0)
					.selectAll( "stop" )
						.data(palette)
						.enter()
							.append( "stop" )
							.attr( "offset", function(d, i) { return i/(palette.length-1)*100.0 + "%"; })
							.attr( "stop-color", function(d) { return d; });
			d3.select( "#gradientRect" ).style( "fill", "url(#" + gradientId + ")" );
		}

	});

})();