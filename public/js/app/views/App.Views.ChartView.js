;( function() {
	
	"use strict";

	App.Views.ChartView = Backbone.View.extend({

		el: "#chart-view",
		events: {},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			this.render();

			//setup events
			App.ChartModel.on( "change", this.onChartModelChange, this );

		},

		render: function() {
			
			this.$el.find( ".chart-name" ).text( App.ChartModel.get( "chart-name" ) );
			this.$el.find( ".chart-description" ).html( App.ChartModel.get( "chart-description" ) );
			
			if( App.ChartModel.get( "chart-variable" ) ) {
				var that = this;
				$.ajax( {
					url: Global.rootUrl + "/variables/" + App.ChartModel.get( "chart-variable" ),
					success: function( response ) {
						that.updateChart( response.data.data );
					}
				});
			} else {
				this.updateChart( App.ChartModel.get( "chart-data" ) );
			}
			
		},

		onChartModelChange: function( evt ) {

			this.render();

		},

		updateChart: function( data ) {

			if( !data ) {
				return;
			}

			//make local copy of data for our filtering needs
			var localData = $.extend( true, localData, data );

			//filter data for selected countries
			var selectedCountries = App.ChartModel.get( "selected-countries" );
			localData = _.filter( localData, function( value, key, list ) {
				return ( _.indexOf( selectedCountries, value.key ) > -1 );
			} );

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
				yAxisMax = ( yAxis[ "axis-max" ] || null );

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
				
				//forcing xAxis - do not force zero
				var forceX = [];
				if( !isNaN( xAxisMin ) ) {
					forceX.push( xAxisMin );
				}
				if( !isNaN( xAxisMax ) ) {
					forceX.push( xAxisMax );
				}
				that.chart.forceX( forceX );

				//forcing yAxis
				var forceY = [];
				if( !isNaN( yAxisMin ) ) {
					forceY.push( yAxisMin );
				}
				if( !isNaN( xAxisMax ) ) {
					forceY.push( yAxisMax );
				}
				that.chart.forceY( forceY );

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