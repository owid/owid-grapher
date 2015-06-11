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
			this.$el.find( ".chart-subname" ).text( App.ChartModel.get( "chart-subname" ) );
			this.$el.find( ".chart-description" ).html( App.ChartModel.get( "chart-description" ) );
			
			//data tab
			this.$dataTab = this.$el.find( "#data-chart-tab" );
			this.$downloadBtn = this.$dataTab.find( ".download-data-btn" );
			this.$dataTableWrapper = this.$dataTab.find( ".data-table-wrapper" );
			
			//sources tab
			this.$sourcesTab = this.$el.find( "#sources-chart-tab" );

			var dimensionsString = App.ChartModel.get( "chart-dimensions" );
			if( App.ChartModel.get( "chart-data" ) ) {
			
				this.updateChart( App.ChartModel.get( "chart-data" ) );
			
			} else if( dimensionsString ) {

				var that = this;
				$.ajax( {
					url: Global.rootUrl + "/data/dimensions",
					data: { "dimensions": dimensionsString, "chartType": App.ChartModel.get( "chart-type" ) },
					success: function( response ) {
						if( response.data ) {
							that.updateChart( response.data, response.timeType );
						}
						if( response.datasources ) {
							that.updateSourceTab( response.datasources );
						}
						if( response.exportData ) {
							that.updateDataTab( response.exportData );
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
				saveSvgAsPng( $( ".nvd3-svg" ).get( 0 ), "chart.png");
			}
			
		},

		updateChart: function( data, timeType ) {

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
				//TODO - nonsense? just convert associative array to array
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

			var that = this;
			nv.addGraph(function() {

				function tooltipContent(key, y, e, graph) {
					return "<h3>" + key + "</h3><p>" + e + App.ChartModel.get( "unit" ) + "</p>";
				}

				var chartOptions = {
					transitionDuration: 300,
					margin: App.ChartModel.get( "margins" ),
					tooltipContent: tooltipContent/*,
					defined: function( d ) { return d.y != 0; }*/								
				};

				//line type
				var lineType = App.ChartModel.get( "line-type" );
				if( lineType == 2 ) {
					chartOptions.defined = function( d ) { return d.y !== 0; }
				} 
				if( lineType == 0 ) {
					that.$el.addClass( "line-dots" );
				} else {
					that.$el.removeClass( "line-dots" );
				}

				//depending on chart type create chart
				var chartType = App.ChartModel.get( "chart-type" );
				if( chartType == "1" ) {
					that.chart = nv.models.lineChart().options( chartOptions );
				} else if( chartType == "2" ) {
					that.chart = nv.models.scatterChart().showDistX(true).showDistY(true);
				}

				that.chart.xAxis
					.axisLabel( xAxis[ "axis-label" ] )
					.staggerLabels( true )
					.axisLabelDistance( xAxisLabelDistance )
					.tickFormat( function(d) { return that.formatTimeLabel( timeType, d, xAxisPrefix, xAxisSuffix ); });
				
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
		
		},

		updateDataTab: function( data ) {

			this.$dataTableWrapper.empty();

			//update link
			var dimensionsString = App.ChartModel.get( "chart-dimensions" ),
				chartType = App.ChartModel.get( "chart-type" ),
				baseUrl = this.$downloadBtn.attr( "data-base-url" ),
				dimensionsUrl = encodeURIComponent( dimensionsString );
			this.$downloadBtn.attr( "href", baseUrl + "?dimensions=" + dimensionsUrl + "&chartType=" + chartType + "&export=csv" );

			var tableString = "<table class='data-table'>";

			_.each( data, function( rowData, rowIndex ) {

				var tr = "<tr>";
				if( rowIndex == 0) {
					
					//create header file from cell information
					_.each( rowData, function( value ) {
						var th = "<th>" + value + "</th>";
						tr += th;
					} );
				
				} else {
					
					_.each( rowData, function( value, index ) {
						var td = ( index == 0 )? "<td><strong>" + value + "</strong></td>": "<td>" + value + "</td>";
						tr += td;
					} );
				
				}
				tr += "</tr>";
				tableString += tr;

			} );

			tableString += "</table>";

			var $table = $( tableString );
			this.$dataTableWrapper.append( $table );	

		},

		updateSourceTab: function( data ) {

			var footerHtml = "",
				tabHtml = "",
				descriptiontionHtml = App.ChartModel.get( "chart-description" ),
				sourcesShortHtml = "Data sources: ",
				sourcesLongHtml = "Data sources: ";
			
			//construct source html
			_.each( data, function( sourceData, sourceIndex ) {
				if( sourceIndex > 0 ) {
					sourcesHtml += ", ";
				}
				sourcesShortHtml += sourceData.name;
				sourcesLongHtml += sourceData.description;
			} );

			footerHtml = descriptiontionHtml + "<br />" + sourcesShortHtml;
			tabHtml = descriptiontionHtml + "<br /><br />" + sourcesLongHtml;

			//append to DOM
			this.$el.find( ".chart-description" ).html( footerHtml );
			this.$sourcesTab.html( tabHtml );

		},

		formatTimeLabel: function( type, d, xAxisPrefix, xAxisSuffix ) {
			//depending on type format label
			var label;
			switch( type ) {
				
				case "Decade":
					
					var decadeString = d.toString();
					decadeString = decadeString.substring( 0, decadeString.length - 1);
					decadeString = decadeString + "0s";
					label = decadeString;

					break;

				case "Quarter Century":
					
					var quarterString = "",
						quarter = d % 100;
					
					if( quarter < 25 ) {
						quarterString = "1st quarter of the";
					} else if( quarter < 50 ) {
						quarterString = "half of the";
					} else if( quarter < 75 ) {
						quarterString = "3rd quarter of the";
					} else {
						quarterString = "4th quarter of the";
					}
						
					var centuryString = App.Utils.centuryString( d );

					label = quarterString + " " + centuryString;

					break;

				case "Half Century":
					
					var halfString = "",
						half = d % 100;
					
					if( half < 50 ) {
						halfString = "1st half of the";
					} else {
						halfString = "2nd half of the";
					}
						
					var centuryString = App.Utils.centuryString( d );

					label = halfString + " " + centuryString;

					break;

				case "Century":
					
					label = App.Utils.centuryString( d );

					break;

				default:
					label = d.toString();
					break;
			}
			return xAxisPrefix + label + xAxisSuffix;
		}

	});

})();