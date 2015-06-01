;( function() {
	
	"use strict";

	App.Views.ChartView = Backbone.View.extend({

		el: "#chart-view",
		events: {
			"click .chart-save-png-btn": "onSavePng"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.header = new App.Views.Chart.Header( { dispatcher: this.dispatcher } );

			this.render();

			//setup events
			App.ChartModel.on( "change", this.onChartModelChange, this );

		},

		render: function() {
			
			this.$el.find( ".chart-name" ).text( App.ChartModel.get( "chart-name" ) );
			this.$el.find( ".chart-description" ).html( App.ChartModel.get( "chart-description" ) );
			
			var dimensionsString = App.ChartModel.get( "chart-dimensions" );
			if( App.ChartModel.get( "chart-data" ) ) {
			
				this.updateChart( App.ChartModel.get( "chart-data" ) );
			
			} else if( dimensionsString ) {

				var that = this;
				$.ajax( {
					url: Global.rootUrl + "/data/dimensions",
					data: { "dimensions": dimensionsString },
					success: function( response ) {
						if( response.data ) {
							that.updateChart( response.data );
						}
					}
				} );

			} 

			/*if( App.ChartModel.get( "chart-variable" ) ) {
				var that = this;
				$.ajax( {
					url: Global.rootUrl + "/variables/" + App.ChartModel.get( "chart-variable" ),
					success: function( response ) {
						that.updateChart( response.data.data );
					}
				});
			} else {
				this.updateChart( App.ChartModel.get( "chart-data" ) );
			}*/
			
		},

		onChartModelChange: function( evt ) {

			this.render();

		},

		onSavePng: function( evt ) {

			evt.preventDefault();
			//App.Utils.encodeSvgToPng( $( ".nvd3-svg" ).get( 0 ).innerHTML );
			var $svgCanvas = $( ".nvd3-svg" );
			if( $svgCanvas.length ) {
				saveSvgAsPng( $( ".nvd3-svg" ).get( 0 ), "diagram.png");
			}
			
		},

		updateChart: function( data ) {

			if( !data ) {
				return;
			}

			//make local copy of data for our filtering needs
			var localData = $.extend( true, localData, data );

			//filter data for selected countries
			var selectedCountries = App.ChartModel.get( "selected-countries" ),
				selectedCountriesNames = _.map( selectedCountries, function(v) { return v.name; } );

			if( selectedCountries && selectedCountriesNames.length ) {
				localData = _.filter( localData, function( value, key, list ) {
					//set color while in the loop
					var country = selectedCountries[ value.key ];
					if( country && country.color ) {
						value.color = country.color;
					}
					//actual filtering
					return ( _.indexOf( selectedCountriesNames, value.key ) > -1 );
				} );
			} else {
				//TODO - nonose? just convert associative array to array
				localData = _.map( localData, function( value ) { return value; } );
			}
			

			//filter by chart time
			var chartTime = App.ChartModel.get( "chart-time" );
			if( chartTime && chartTime.length == 2 ) {
				
				var timeFrom = chartTime[ 0 ],
					timeTo = chartTime[ 1 ];
				
				_.each( localData, function( singleData, key, list ) {
					var values = _.clone( singleData.values );
					values = _.filter( values, function( value ) {
						return ( value.x >= timeFrom && value.x <= timeTo );
					} );
					singleData.values = values
				} );

			}

			//get axis configs
			var xAxis = App.ChartModel.get( "x-axis" ),
				yAxis = App.ChartModel.get( "y-axis" ),
				xAxisPrefix = ( xAxis[ "axis-prefix" ] || "" ),
				xAxisSuffix = ( xAxis[ "axis-suffix" ] || "" ),
				yAxisPrefix = ( yAxis[ "axis-prefix" ] || "" ),
				yAxisSuffix = ( yAxis[ "axis-suffix" ] || "" ),
				xAxisLabelDistance = ( +xAxis[ "axis-label-distance" ] || 0 ),
				yAxisLabelDistance = ( +yAxis[ "axis-label-distance" ] || 0 ),
				xAxisMin = ( xAxis[ "axis-min" ] || null ),
				xAxisMax = ( xAxis[ "axis-max" ] || null ),
				yAxisMin = ( yAxis[ "axis-min" ] || 0 ),
				yAxisMax = ( yAxis[ "axis-max" ] || null ),
				xAxisScale = ( xAxis[ "axis-scale" ] || "linear" ),
				yAxisScale = ( yAxis[ "axis-scale" ] || "linear" );

			console.log( xAxis, yAxis, xAxisMin, xAxisMax, yAxisMin, yAxisMax, xAxisScale, yAxisScale );

			var that = this;
			nv.addGraph(function() {
				that.chart = nv.models.lineChart()
							.options({
								transitionDuration: 300,
								margin: { top: 100, left: 80, bottom: 100, right: 80 },
								tooltipContent: tooltipContent });
				
				that.chart.xAxis
					.axisLabel( xAxis[ "axis-label" ] )
					.staggerLabels( true )
					.axisLabelDistance( xAxisLabelDistance )
					.tickFormat( function(d) { return xAxisPrefix + d + xAxisSuffix; });
				
				//get extend
				var allValues = [];
				_.each( localData, function( v, i ) {
					allValues = allValues.concat( v.values );
				} );
				
				var xDomain = d3.extent( allValues.map( function( d ) { return d.x; } ) ),
					yDomain = d3.extent( allValues.map( function( d ) { return d.y; } ) ),
					isClamped = false;
				if( xAxisMin && !isNaN( xAxisMin ) ) {
					xDomain[ 0 ] = xAxisMin;
					isClamped = true;
				}
				if( xAxisMax && !isNaN( xAxisMax ) ) {
					xDomain[ 1 ] = xAxisMax;
					isClamped = true;
				}
				if( yAxisMin && !isNaN( yAxisMin ) ) {
					yDomain[ 0 ] = yAxisMin;
					isClamped = true;
				}
				if( yAxisMax && !isNaN( yAxisMax ) ) {
					yDomain[ 1 ] = yAxisMax;
					isClamped = true;
				}

				//manually clamp values
				if( isClamped ) {
					that.chart.xDomain( xDomain );
					that.chart.yDomain( yDomain );
					that.chart.xScale().clamp( true );
					that.chart.yScale().clamp( true );
				}

				//set scales
				if( xAxisScale === "linear" ) {
					that.chart.xScale( d3.scale.linear() ); 
				} else if( xAxisScale === "log" ) {
					that.chart.xScale( d3.scale.log() ); 
				}
				if( yAxisScale === "linear" ) {
					that.chart.yScale( d3.scale.linear() ); 
				} else if( yAxisScale === "log" ) {
					that.chart.yScale( d3.scale.log() ); 
				}

				that.chart.yAxis
					.axisLabel( yAxis[ "axis-label" ] )
					.axisLabelDistance( yAxisLabelDistance )
					.tickFormat( function(d) { return yAxisPrefix + d + yAxisSuffix; });
				var svgSelection = d3.select( "svg" )
					.datum(localData)
					.call(that.chart);

				nv.utils.windowResize(that.chart.update);

			});

		}

	});

})();