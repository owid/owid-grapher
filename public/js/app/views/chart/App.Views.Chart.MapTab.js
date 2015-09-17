;( function() {
	
	"use strict";

	App.Views.Chart.MapTab = Backbone.View.extend({

		COLOR_SCHEME: [ "#dadaeb", "#bcbddc", "#9e9ac8", "#807dba", "#6a51a3", "#54278f", "#3f007d" ],

		dataMap: null,
		legend: null,

		events: {},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			return this.render();
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

			return this;
		},

		update: function( data ) {

			var dataMin = Infinity,
				dataMax = -Infinity;

			//need to extract latest time
			var latestData = data.map( function( d, i ) {

				var values = d.values,
					latestTimeValue = ( values && values.length )? values[ values.length - 1].y: 0;

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