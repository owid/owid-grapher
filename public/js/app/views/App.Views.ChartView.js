;( function() {
	
	"use strict";

	App.Views.ChartView = Backbone.View.extend({

		el: "#chart-view",
		events: {
			"click .chart-save-png-btn": "exportContent",
			"click .chart-save-svg-btn": "exportContent",
			"change [name=available_entities]": "onAvailableCountries"
		},

		initialize: function( options ) {
			
			this.dispatcher = options.dispatcher;
			
			this.header = new App.Views.Chart.Header( { dispatcher: this.dispatcher } );

			this.render();

			//setup events
			App.ChartModel.on( "change", this.onChartModelChange, this );

		},

		render: function() {
			
			var that = this;

			//chart tab
			this.$svg = this.$el.find( "svg" );
			this.$tabContent = this.$el.find( ".tab-content" );
			this.$tabPanes = this.$el.find( ".tab-pane" );
			this.$chartHeader = this.$el.find( ".chart-header" );
			this.$entitiesSelect = this.$el.find( "[name=available_entities]" );
			this.$chartFooter = this.$el.find( ".chart-footer" );
			this.$chartName = this.$el.find( ".chart-name" );
			this.$chartSubname = this.$el.find( ".chart-subname" );
			this.$chartDescription = this.$el.find( ".chart-description" );
			this.$chartSources = this.$el.find( ".chart-sources" );
			
			//update values
			this.$chartName.text( App.ChartModel.get( "chart-name" ) );
			this.$chartSubname.html( App.ChartModel.get( "chart-subname" ) );

			var chartDescription = App.ChartModel.get( "chart-description" );
			//this.$chartDescription.text( App.ChartModel.get( "chart-description" ) );

			//update countries
			var	formConfig = App.ChartModel.get( "form-config" ),
				entities = ( formConfig && formConfig[ "entities-collection" ] )? formConfig[ "entities-collection" ]: [],
				selectedCountries = App.ChartModel.get( "selected-countries" ),
				selectedCountriesIds = _.map( selectedCountries, function( v ) { return (v)? +v.id: ""; } ),
				chartTime = App.ChartModel.get( "chart-time" );

			this.$entitiesSelect.empty();
			if( selectedCountriesIds.length ) {
				//append empty default option
				that.$entitiesSelect.append( "<option disabled selected>Select country</option>" );
				_.each( entities, function( d, i ) {
					//add only those entities, which are not selected already
					if( _.indexOf( selectedCountriesIds, +d.id ) == -1 ) {
						that.$entitiesSelect.append( "<option value='" + d.id + "'>" + d.name + "</option>" );
					}
				} );
			}
			//make chosen update, make sure it looses blur as well
			this.$entitiesSelect.trigger( "chosen:updated" );
			
			//data tab
			this.$dataTab = this.$el.find( "#data-chart-tab" );
			this.$downloadBtn = this.$dataTab.find( ".download-data-btn" );
			this.$dataTableWrapper = this.$dataTab.find( ".data-table-wrapper" );
			
			//sources tab
			this.$sourcesTab = this.$el.find( "#sources-chart-tab" );
			var dimensionsString = App.ChartModel.get( "chart-dimensions" );
			if( dimensionsString ) {

				$.ajax( {
					url: Global.rootUrl + "/data/dimensions",
					data: { "dimensions": dimensionsString, "chartId": App.ChartModel.get( "id" ), "chartType": App.ChartModel.get( "chart-type" ), "selectedCountries": selectedCountriesIds, "chartTime": chartTime, "cache": App.ChartModel.get( "cache" ), "onlyEntityMatch": App.ChartModel.get( "only-entity-match" )  },
					success: function( response ) {
						//test removing chart when response false - doesn't work
						/*if( !response.success ) {
							//didn't get correct data, just erase chart
							that.$svg.find( "> .nvd3.nv-wrap" ).empty();
						}*/
						if( response.data ) {
							that.updateChart( response.data, response.timeType );
						}
						if( response.datasources ) {
							that.updateSourceTab( response.datasources, response.license );
						}
						if( response.exportData ) {
							that.updateDataTab( response.exportData );
						}
					}
				} );

			} else {

				//clear any previous chart
				$( "svg" ).empty();

			}

		},

		onChartModelChange: function( evt ) {

			this.render();

		},

		exportContent: function( evt ) {

			
			//http://stackoverflow.com/questions/23218174/how-do-i-save-export-an-svg-file-after-creating-an-svg-with-d3-js-ie-safari-an
			var $btn = $( evt.currentTarget ),
				//store pre-printing svg
				$oldEl = this.$el,
				$newEl = $oldEl.clone(),
				isSvg = ( $btn.hasClass( "chart-save-svg-btn" ) )? true: false;
			
			$oldEl.replaceWith( $newEl );

			//grab all svg
			var $svg = $newEl.find( "svg" ),
				svg = $svg.get( 0 ),
				svgString = svg.outerHTML;

			//add printing styles
			$svg.attr( "class", "nvd3-svg export-svg" );

			//inline styles for the export
			var styleSheets = document.styleSheets;
			for( var i = 0; i < styleSheets.length; i++ ) {
				this.inlineCssStyle( styleSheets[ i ].cssRules );
			}

			//depending whether we're creating svg or png, 
			if( isSvg ) {

				var serializer = new XMLSerializer(),
				source = serializer.serializeToString(svg);
				//add name spaces.
				if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
					source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
				}
				if(!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)){
					source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
				}
				
				//add xml declaration
				source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

				//convert svg source to URI data scheme.
				var url = "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(source);
				$btn.attr( "href", url );

			} else {

				var $svgCanvas = $( ".nvd3-svg" );
				if( $svgCanvas.length ) {
					saveSvgAsPng( $( ".nvd3-svg" ).get( 0 ), "chart.png");
				}

			}
			
			//add back the printed svg
			$newEl.replaceWith( $oldEl );
			//refresh link
			$oldEl.find( ".chart-save-png-btn" ).on( "click", $.proxy( this.exportContent, this ) );

		},

		updateChart: function( data, timeType ) {

			if( !data ) {
				return;
			}

			//make local copy of data for our filtering needs
			var localData = $.extend( true, localData, data );

			//filter data for selected countries
			var selectedCountries = App.ChartModel.get( "selected-countries" ),
				selectedCountriesById = [],
				selectedCountriesIds = _.map( selectedCountries, function(v) {
					//store 
					selectedCountriesById[ v.id ] = v;
					return +v.id;
				} );

			if( selectedCountries && selectedCountriesIds.length ) {
				localData = _.filter( localData, function( value, key, list ) {
					//set color while in the loop
					var country = selectedCountriesById[ value.id ];
					if( country && country.color ) {
						value.color = country.color;
					}
					//actual filtering
					return ( _.indexOf( selectedCountriesIds, value.id ) > -1 );
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

				var chartOptions = {
					transitionDuration: 300,
					margin: { top:0, left:50, right:30, bottom:0 },// App.ChartModel.get( "margins" ),
					showLegend: false
				};

				//line type
				var lineType = App.ChartModel.get( "line-type" );
				if( lineType == 2 ) {
					chartOptions.defined = function( d ) { return d.y !== 0; };
				}
				if( lineType === 0 ) {
					that.$el.addClass( "line-dots" );
				} else {
					that.$el.removeClass( "line-dots" );
				}

				//depending on chart type create chart
				var chartType = App.ChartModel.get( "chart-type" );
				if( chartType == "1" ) {
					that.chart = nv.models.lineChart().options( chartOptions );
				} else if( chartType == "2" ) {
					that.chart = nv.models.scatterChart().options( chartOptions );//f.showDistX(true).showDistY(true);
				}

				that.chart.xAxis
					.axisLabel( xAxis[ "axis-label" ] )
					//.staggerLabels( true )
					.axisLabelDistance( xAxisLabelDistance )
					.tickFormat( function(d) { return that.formatTimeLabel( timeType, d, xAxisPrefix, xAxisSuffix ); });
				
				if( timeType == "Quarter Century" ) {
					that.chart.xAxis.staggerLabels( true );
				}
				
				//get extend
				var allValues = [];
				_.each( localData, function( v, i ) {
					allValues = allValues.concat( v.values );
				} );
				
				//domain setup
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
				} else {
					//default is zero
					yDomain[ 0 ] = 0;
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
				
				var svgSelection = d3.select( that.$svg.selector )
					.datum( localData )
					.call( that.chart );

				//set popup
				that.chart.tooltip.contentGenerator( function( data ) {
					
					//find relevant values for popup and display them
					var series = data.series, key = "", value = "", value2 = "", time = "";
					if( series && series.length ) {
						var serie = series[ 0 ];
						key = serie.key;
						value = serie.value;
						//get second value for x axis
						if( data.point ) {
							value2 = data.point.x;
							time = data.point.time;
						}
					}

					var string = "<h3>" + key + "</h3><p>" + value + " " + App.ChartModel.get( "unit" );
					//display time for line chart
					if( time && App.ChartModel.get( "chart-type" ) != 1 ) {
						string +=  ", " + value2 + " in " + time;
					}
					string += "</p>";
					return string;

				} );

				//set legend
				that.legend = new App.Views.Chart.Legend( that.chart.legend ).vers( "owd" );
				that.legend.dispatch.on( "removeEntity", function( id ) {
					that.onRemoveEntity( id );
				} );
				that.legend.dispatch.on( "addEntity", function() {
					if( that.$entitiesSelect.data( "chosen" ) ) {
						that.$entitiesSelect.data( "chosen" ).active_field = false;
					}
					//trigger open the chosen drop down
					that.$entitiesSelect.trigger( "chosen:open" );
				} );

				svgSelection.call( that.legend );

				var onResizeCallback = _.debounce( function(e) {
					//invoke resize of legend
					svgSelection.call( that.legend );
					that.onResize();
				}, 150 );
				nv.utils.windowResize( onResizeCallback );
					
				that.onResize();

				that.chart.dispatch.on( "stateChange", function( state ) {
					//refersh legend;
					svgSelection.call( that.legend );
					//need timeout 
					setTimeout( function() {
						that.onResize();
					}, 1);
				} );

			});
		
		},

		onRemoveEntity: function( id ) {

			var selectedCountries = App.ChartModel.get( "selected-countries" ),
				countriesIds = _.keys( selectedCountries );

			if( countriesIds.length === 0 ) {
				//removing from empty selection, need to copy all countries available into selected countries selection
				var entitiesCollection = [],
				//var entitiesCollection = {},
					formConfig = App.ChartModel.get( "form-config" );
				if( formConfig && formConfig[ "entities-collection" ] ) {
					_.map( formConfig[ "entities-collection" ], function( d, i ) { entitiesCollection[ d.id ] = d; } );
					//deep copy array
					var entitiesCopy =  $.extend( true, [], formConfig[ "entities-collection" ] );
					App.ChartModel.set( "selected-countries", entitiesCopy );
				}
			}
			App.ChartModel.removeSelectedCountry( id );

		},

		onAvailableCountries: function( evt ) {

			var $select = $( evt.currentTarget ),
				val = $select.val(),
				$option = $select.find( "[value=" + val + "]" ),
				text = $option.text();

			App.ChartModel.addSelectedCountry( { id: $select.val(), name: text } );

			//double check if we don't have full selection of countries
			var entitiesCollection = {},
				formConfig = App.ChartModel.get( "form-config" );
			if( formConfig && formConfig[ "entities-collection" ] ) {
				var selectedCountriesIds = _.keys( App.ChartModel.get( "selected-countries" ) );
				if( selectedCountriesIds.length == formConfig[ "entities-collection" ].length ) {
					App.ChartModel.set( "selected-countries", [], {silent:true} );
				}
			}

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

		updateSourceTab: function( sources, license ) {

			var footerHtml = "",
				tabHtml = "",
				descriptionHtml = App.ChartModel.get( "chart-description" ),
				sourcesShortHtml = "Data sources: ",
				sourcesLongHtml = "Data sources: ";
			
			//construct source html
			_.each( sources, function( sourceData, sourceIndex ) {
				if( sourceIndex > 0 ) {
					sourcesShortHtml += ", ";
				}
				if( sourceData.link ) {
					sourcesShortHtml += "<a xlink:href='" + sourceData.link + "' target='_blank'>" + sourceData.name + "</a>";
				} else {
					sourcesShortHtml += sourceData.name;
				}
				sourcesLongHtml += sourceData.description;
			} );

			footerHtml = descriptionHtml;
			tabHtml = descriptionHtml + "<br /><br />" + sourcesLongHtml;

			//add license info
			if( license && license.description ) {
				footerHtml = license.description + " " + footerHtml;
				tabHtml = license.description + " " + tabHtml;
			}
			
			//append to DOM
			this.$chartDescription.html( footerHtml );
			this.$chartSources.html( sourcesLongHtml );
			this.$sourcesTab.html( tabHtml );

		},

		onResize: function() {

			//compute how much space for chart
			var svgWidth = this.$svg.width(),
				svgHeight = this.$svg.height(),
				$chartNameSvg = this.$el.find( ".chart-name-svg" ),
				$chartSubnameSvg = this.$el.find( ".chart-subname-svg" ),
				$chartDescriptionSvg = this.$el.find( ".chart-description-svg" ),
				$chartSourcesSvg = this.$el.find( ".chart-sources-svg" ),
				chartHeaderHeight = this.$chartHeader.height(),
				margins = App.ChartModel.get( "margins" ),
				topChartMargin = 30,
				bottomChartMargin = 60,
				currY, footerDescriptionHeight, footerSourcesHeight, chartHeight;

			this.$tabContent.height( $( ".chart-wrapper-inner" ).height() - this.$chartHeader.height() );

			//wrap header text
			App.Utils.wrap( $chartNameSvg, svgWidth );
			currY = parseInt( $chartNameSvg.attr( "y" ) ) + $chartNameSvg.outerHeight() + 20;
			$chartSubnameSvg.attr( "y", currY );
			
			//wrap description
			App.Utils.wrap( $chartSubnameSvg, svgWidth );

			//start positioning the graph, according 
			currY = chartHeaderHeight;

			var translateY = currY,
				margins = App.ChartModel.get( "margins" );
			
			this.$svg.height( this.$tabContent.height() + currY );

			//update stored height
			svgHeight = this.$svg.height();

			//add height of legend
			//currY += this.chart.legend.height();
			currY += this.legend.height();

			//position chart
			App.Utils.wrap( $chartDescriptionSvg, svgWidth );
			footerDescriptionHeight = $chartDescriptionSvg.height();
			App.Utils.wrap( $chartSourcesSvg, svgWidth );
			footerSourcesHeight = $chartSourcesSvg.height();

			var footerHeight = this.$chartFooter.height();

			//set chart height
			chartHeight = svgHeight - translateY - footerHeight - bottomChartMargin - this.legend.height();
			//reflect margin top and down in chartHeight
			chartHeight = chartHeight - margins.bottom - margins.top;

			//position footer
			$chartDescriptionSvg.attr( "y", currY + chartHeight + bottomChartMargin );
			App.Utils.wrap( $chartDescriptionSvg, svgWidth );
			$chartSourcesSvg.attr( "y", parseInt( $chartDescriptionSvg.attr( "y" ) ) + $chartDescriptionSvg.height() + footerDescriptionHeight/3 );
			App.Utils.wrap( $chartSourcesSvg, svgWidth );
			
			//compute chart width
			var chartWidth = svgWidth - margins.left - margins.right;
			this.chart.width( chartWidth );
			this.chart.height( chartHeight );

			//need to call chart update for resizing of elements within chart
			this.chart.update();

			//position legend
			var legendMargins = this.legend.margin();
			currY = currY - this.legend.height();
			this.translateString = "translate(" + legendMargins.left + " ," + currY + ")";
			this.$svg.find( "> .nvd3.nv-legend" ).attr( "transform", this.translateString );
			this.$svg.css( "transform", "translate(0,-" + chartHeaderHeight + "px)" );

			//reflect margin top in currY
			currY += +this.legend.height();
			currY += +margins.top;
			
			//manually reposition chart after update
			//this.translateString = "translate(" + margins.left + "," + currY + ")";
			this.translateString = "translate(" + margins.left + "," + currY + ")";
			this.$svg.find( "> .nvd3.nv-wrap" ).attr( "transform", this.translateString );
			
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
		},

		inlineCssStyle: function( rules ) {
			//http://devintorr.es/blog/2010/05/26/turn-css-rules-into-inline-style-attributes-using-jquery/
			for (var idx = 0, len = rules.length; idx < len; idx++) {
				$(rules[idx].selectorText).each(function (i, elem) {
					elem.style.cssText += rules[idx].style.cssText;
				});
			}

		}

	});

})();