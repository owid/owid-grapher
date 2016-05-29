;(function() {
	"use strict";
	owid.namespace("App.Views.Chart.ChartTab");

	App.Views.Chart.ChartTab = Backbone.View.extend( {

		cachedColors: [],
		el: "#chart-view",
		events: {
			"change [name=available_entities]": "onAvailableCountries"
		},

		initialize: function( options ) {
			this.dispatcher = options.dispatcher;
			this.parentView = options.parentView;
			this.$tab = this.$el.find("#chart-chart-tab");
			this.$svg = this.$el.find("svg");
		},

		onChartModelChange: function() {
			App.DataModel.ready(function() {
				this.render(this.onResize.bind(this));
			}.bind(this));
		},

		activate: function(callback) {
			App.ChartModel.on("change", this.onChartModelChange, this);

			var that = this;

			//chart tab
			this.$svg = $("svg");
			this.$svg.attr("class", "nvd3-svg");
			this.$tabContent = this.$el.find( ".tab-content" );
			this.$tabPanes = this.$el.find( ".tab-pane" );
			this.$chartHeader = this.$el.find( ".chart-header" );
			this.$entitiesSelect = this.$el.find( "[name=available_entities]" );
			this.$chartFooter = this.$el.find( ".chart-footer" );

			this.$chartDescription = this.$el.find( ".chart-description" );
			this.$chartSources = this.$el.find( ".chart-sources" );
			this.$chartFullScreen = this.$el.find( ".fancybox-iframe" );

			this.$xAxisScaleSelector = this.$el.find( ".x-axis-scale-selector" );
			this.$xAxisScale = this.$el.find( "[name=x_axis_scale]" );
			this.$yAxisScaleSelector = this.$el.find( ".y-axis-scale-selector" );
			this.$yAxisScale = this.$el.find( "[name=y_axis_scale]" );

			this.$reloadBtn = this.$el.find( ".reload-btn" );
			var chartTime = App.ChartModel.get("chart-time");

			var chartDescription = App.ChartModel.get( "chart-description" );
			//this.$chartDescription.text( App.ChartModel.get( "chart-description" ) );

			//show/hide scale selectors
			var showXScaleSelectors = App.ChartModel.get( "x-axis-scale-selector" );
			if( showXScaleSelectors ) {
				this.$xAxisScaleSelector.show();
			} else {
				this.$xAxisScaleSelector.hide();
			}
			var showYScaleSelectors = App.ChartModel.get( "y-axis-scale-selector" );
			if( showYScaleSelectors ) {
				this.$yAxisScaleSelector.show();
			} else {
				this.$yAxisScaleSelector.hide();
			}

			//refresh btn
			this.$reloadBtn.on("click", function(evt) {
				evt.preventDefault();
				window.location.reload();
			});

			var dimensionsString = App.ChartModel.get( "chart-dimensions" ),
				validDimensions = false;

			//clicking anything in chart source will take you to sources tab
			this.$chartSources.on( "click", function(evt) {
				evt.preventDefault();
				var $a = $( "[href='#sources-chart-tab']" );
				$a.trigger( "click" );
			} );

			//check we have all dimensions necessary 
			if( !$.isEmptyObject( dimensionsString ) ) {
				var dimension = $.parseJSON( dimensionsString );
				validDimensions = App.Utils.checkValidDimensions( dimension, App.ChartModel.get( "chart-type" ));
			}

			if( !validDimensions ) {
				return false;
			}

			this.render(callback);
		},

		deactivate: function() {
			App.ChartModel.off(null, null, this);
			d3.selectAll(".nvd3").remove();
			this.$yAxisScaleSelector.show();
		},

		updateAvailableCountries: function() {
			var availableEntities = App.DataModel.get("availableEntities"),
				selectedCountries = App.ChartModel.get("selected-countries"),
				selectedCountriesIds = _.map(selectedCountries, function(v) { return (v)? +v.id: ""; });

			// Fill entity selector with all entities not currently selected
			this.$entitiesSelect.empty();
			this.$entitiesSelect.append("<option disabled selected>Select country</option>");
			_.each(availableEntities, function(entity) {
				if (!_.contains(selectedCountriesIds, +entity.id)) {
					this.$entitiesSelect.append("<option value='" + entity.id + "'>" + entity.name + "</option>");
				}
			}.bind(this));

			this.$entitiesSelect.trigger("chosen:updated");
		},

		render: function(callback) {
			var data = App.DataModel.transformData();
			var timeType = "Year";

			if (!data) {
				return;
			}

			this.updateAvailableCountries();

			var that = this;

			//make local copy of data for our filtering needs
			var localData = $.extend( true, localData, data );

			var chartType = App.ChartModel.get( "chart-type" );

			//filter data for selected countries
			var selectedCountries = App.ChartModel.get("selected-countries");

			var selectedCountriesById = [],
				selectedCountriesIds = _.map( selectedCountries, function(v) {
					//store
					selectedCountriesById[ v.id ] = v;
					return +v.id;
				} );

			if( selectedCountries && selectedCountriesIds.length && !App.ChartModel.get( "group-by-variables" ) ) {
				//set local copy of countries color, to be able to create brighter
				var countriesColors = [];
				localData = _.filter( localData, function( value, key, list ) {
					//set color while in the loop
					var id = value.id.toString();
					//need to check for special case, when we have more variables for the same countries (the ids will be then 21-1, 22-1, etc.)
					if( id.indexOf( "-" ) > 0 ) {
						id = parseInt( id.split( "-" )[ 0 ], 10 );
					} else {
						id = parseInt( id, 10 );
					}

					var country = selectedCountriesById[ id ];
					if( country && country.color ) {
						if( !countriesColors[ id ] ) {
							countriesColors[ id ] = country.color;
						} else {
							//there is already color for country (multivariant dataset) - create brighter color
							countriesColors[ id ] = d3.rgb( countriesColors[ id ] ).brighter( 1 ).toString();
						}
						value.color = countriesColors[ id ];

					} else {
						value = that.assignColorFromCache( value );
					}

					//actual filtering
					return ( _.indexOf( selectedCountriesIds, id ) > -1 );
				} );
			} else {
				//TODO - nonsense? convert associative array to array, assign colors from cache
				localData = _.map( localData, function( value ) {
					value = that.assignColorFromCache( value );
					return value;
				} );
			}

			var discreteData;
			if( chartType == App.ChartType.DiscreteBar ) {
				var flattenValues = _.map( localData, function( v ) {
					if( v && v.color ) {
						v.values[ 0 ].color = v.color;
					}
					return v.values[0];
				} );
				discreteData = [{ key: "variable", values: flattenValues }];
				localData = discreteData;
			}

			//filter by chart time
			var chartTime = App.ChartModel.get( "chart-time" );
			if( chartTime && chartTime.length == 2 ) {
				
				var timeFrom = chartTime[ 0 ],
					timeTo = chartTime[ 1 ];
				
				_.each( localData, function( singleData, key, list ) {
					var values = _.clone( singleData.values );
					values = _.filter( values, function( value ) {
						if (_.isObject(value.time)) {
							return _.every(value.time, function(val, key) {
								return ( val >= timeFrom && val <= timeTo );
							});							
						} else {
							return ( value.x >= timeFrom && value.x <= timeTo );
						}
					} );
					singleData.values = values;
				} );

			}

			//if legend displayed, sort data on key alphabetically (usefull when multivarian dataset)
			if( !App.ChartModel.get( "hide-legend" ) ) {
				localData = _.sortBy( localData, function( obj ) { return obj.key; } );
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
				yAxisScale = ( yAxis[ "axis-scale" ] || "linear" ),
				xAxisFormat = ( xAxis[ "axis-format" ] || 0 ),
				yAxisFormat = ( yAxis[ "axis-format" ] || 0 );

			//setting up nvd3 chart
			nv.addGraph(function() {
				var chartOptions = {
					margin: { top:0, left:50, right:30, bottom:0 },// App.ChartModel.get( "margins" ),
					showLegend: false
				};

				//line type
				var lineType = App.ChartModel.get( "line-type" );
				if( lineType == App.LineType.UnjoinedIfMissing ) {
					//chartOptions.defined = function( d ) { return d.y == 0; };
				}
				if( lineType == App.LineType.WithDots || lineType == App.LineType.DashedIfMissing ) {
					that.$el.addClass( "line-dots" );
				} else {
					that.$el.removeClass( "line-dots" );
				}

				//depending on chart type create chart
				if( chartType == App.ChartType.LineChart ) {
					that.chart = nv.models.lineChart().options( chartOptions );

				} else if( chartType == App.ChartType.ScatterPlot ) {
					var points = that.scatterBubbleSize();
					that.chart = nv.models.scatterChart().options( chartOptions ).pointRange( points ).showDistX( true ).showDistY( true );

				} else if( chartType == App.ChartType.StackedArea ) {
					//stacked area chart
					//we need to make sure we have as much data as necessary
					if( localData.length ) {
						var baseSeries = localData[0];
						_.each( localData, function( serie, i ) {
							if( i > 0 ) {
								//make sure we have values for given series
								if( serie.values && !serie.values.length ) {
									//clone base series
									var copyValues = [];
									$.extend(true, copyValues, baseSeries.values);
									//nullify values
									_.each( copyValues, function( v, i) {
										v.y = 0;
										v.fake = "true";
									});
									serie.values = copyValues;
								}
							}
						} );
					}

					chartOptions.showTotalInTooltip = true;

					that.chart = nv.models.stackedAreaChart()
						.options(chartOptions)
						.controlOptions(["Stacked", "Expanded"])
						.controlLabels({
							"stacked": "Absolute",
							"expanded": "Relative"
						})
						.useInteractiveGuideline(true)
						.x(function(d) { return d.x; })
						.y(function(d) { return d.y; });

			

				} else if( chartType == App.ChartType.MultiBar || chartType == App.ChartType.HorizontalMultiBar ) {

					//multibar chart
					//we need to make sure we have as much data as necessary
					var allTimes = [],
						//store values by [entity][time]
						valuesCheck = [];

					//extract all times
					_.each( localData, function( v, i ) {
						var entityData = [],
							times = v.values.map( function( v2, i ) {
								entityData[ v2.x ] = true;
								return v2.x;
							} );
						valuesCheck[ v.id ] = entityData;
						allTimes = allTimes.concat( times );
					} );

					allTimes = _.uniq( allTimes );
					allTimes = _.sortBy( allTimes );
					
					if( localData.length ) {
						_.each( localData, function( serie, serieIndex ) {
							
							//make sure we have values for given series
							_.each( allTimes, function( time, timeIndex ) {
								if( valuesCheck[ serie.id ] && !valuesCheck[ serie.id ][ time ] ) {
									//time doesn't existig for given entity, insert zero value
									var zeroObj = {
										"key": serie.key,
										"serie": serieIndex,
										"time": time,
										"x": time,
										"y": 0,
										"fake": true
									};
									serie.values.splice( timeIndex, 0, zeroObj );
								}
							} );
							
						} );
					}

					if( chartType == App.ChartType.MultiBar ) {
					
						that.chart = nv.models.multiBarChart().options( chartOptions );
					
					} else if( App.ChartType.HorizontalMultiBar ) {
					
						that.chart = nv.models.multiBarHorizontalChart().options( chartOptions );//.showValues( true );
					
					}

				} else if( chartType == App.ChartType.DiscreteBar ) {

					chartOptions.showValues = true;

					that.chart = nv.models.discreteBarChart()
						.x( function( d ) { return d.x; } )
						.y( function( d ) { return d.y; } )
						.options( chartOptions );

				}

				that.chart.dispatch.on("renderEnd", function(state) {
					$(window).trigger('chart-loaded');

					/* HACK (Mispy): Ensure stacked area charts maintain the correct dimensions on 
					 * transition between stacked and expanded modes. It cannot be done on renderEnd
					 * or stateChange because the delay causes the chart to jump; overriding update
					 * seems to be the only way to get it to synchronously flow into resizing. It must
					 * be re-overridden in renderEnd because the nvd3 chart render function resets it. Note
					 * that stacked area charts also pay no attention to the margin setting. */
					var origUpdate = that.chart.update;
					that.chart.update = function() {
						origUpdate.call(that.chart);
						that.onResize();
					};								
				});
				//fixed probably a bug in nvd3 with previous tooltip not being removed
				d3.select( ".xy-tooltip" ).remove();

				that.chart.xAxis
					.axisLabel( xAxis[ "axis-label" ] )
					//.staggerLabels( true )
					.axisLabelDistance( xAxisLabelDistance )
					.tickFormat( function(d) {
						if( chartType != 2 ) {
							//x axis has time information
							return App.Utils.formatTimeLabel( timeType, d, xAxisPrefix, xAxisSuffix, xAxisFormat );
						} else {
							//is scatter plot, x-axis has some other information
							return xAxisPrefix + d3.format( "," )( App.Utils.formatValue( d, xAxisFormat ) ) + xAxisSuffix;
						}
					} );

				if( timeType == "Quarter Century" ) {
					that.chart.xAxis.staggerLabels( true );
				}

				//get extend
				var allValues = [];
				_.each( localData, function( v, i ) {
					if( v.values ) {
						allValues = allValues.concat( v.values );
					} else if( $.isArray( v ) ){
						//special case for discrete bar chart
						allValues = v;
					}
				} );

				//domain setup
				var xDomain = d3.extent( allValues.map( function( d ) { return d.x; } ) ),
					yDomain = d3.extent( allValues.map( function( d ) { return d.y; } ) ),
					isClamped = false;
				//console.log( "chart.stacked.style()", that.chart.stacked.style() );

				if( xAxisMin && !isNaN( xAxisMin ) ) {
					xDomain[ 0 ] = xAxisMin;
					isClamped = true;
				}
				if( xAxisMax && !isNaN( xAxisMax ) ) {
					xDomain[ 1 ] = xAxisMax;
					isClamped = true;
				}
				if( yAxisMin && !isNaN( yAxisMin ) && (yAxisMin > 0 || yAxisScale != "log")) {
					yDomain[ 0 ] = yAxisMin;
					isClamped = true;
				} else {
					//default is zero (don't do it for stack bar chart or log scale, messes up things)
					if( chartType != App.ChartType.StackedArea && yAxisScale != "log" ) {
						yDomain[ 0 ] = 0;
						isClamped = true;
					}
				}
				if( yAxisMax && !isNaN( yAxisMax ) ) {
					yDomain[ 1 ] = yAxisMax;
					isClamped = true;
				}

				//manually clamp values
				if( isClamped ) {

					if( chartType !== "4" && chartType !== "5" && chartType !== "6" ) {
						//version which makes sure min/max values are present, but will display values outside of the range
						that.chart.forceX( xDomain );
						that.chart.forceY( yDomain );
						//version which forces domains to contain values just between min/max, won't extend if there is data outside of domain
						/*that.chart.xDomain( xDomain );
						that.chart.yDomain( yDomain );
						that.chart.xScale().clamp( true );
						that.chart.yScale().clamp( true );*/
					}

				}

				//set scales, multibar chart
				if( yAxisScale === "linear" ) {
					that.chart.yScale( d3.scale.linear() );
				} else if( yAxisScale === "log" ) {
					that.chart.yScale( d3.scale.log() );
				}

				if( chartType === "4" || chartType === "5" ) {
					//for multibar chart, x axis has ordinal scale, so need to setup domain properly
					//that.chart.xDomain( d3.range(xDomain[0], xDomain[1] + 1) );
					that.chart.xDomain( allTimes );
				}

				that.chart.yAxis
					.axisLabel( yAxis[ "axis-label" ] )
					.axisLabelDistance( yAxisLabelDistance )
					.tickFormat( function(d) { return yAxisPrefix + d3.format( "," )( App.Utils.formatValue( d, yAxisFormat ) ) + yAxisSuffix; })
					.showMaxMin(false);

				//scatter plots need more ticks
				if( chartType === App.ChartType.ScatterPlot ) {
					//hardcode
					that.chart.xAxis.ticks( 7 );
					that.chart.yAxis.ticks( 7 );
				}

				window.localData = localData;

				var displayData = localData;
				if (chartType == App.ChartType.LineChart && (lineType == App.LineType.DashedIfMissing))// || lineType == App.LineType.UnjoinedIfMissing))
					displayData = that.splitSeriesByMissing(localData);
				window.displayData = displayData;
				that.svgSelection = d3.select( that.$svg.selector )
					.datum(displayData)
					.call( that.chart );

				if( chartType != App.ChartType.StackedArea ) {

					that.chart.tooltip.contentGenerator( owid.contentGenerator );

				} else {

					//set popup
					var unitsString = App.ChartModel.get( "units" ),
						units = ( !$.isEmptyObject( unitsString ) )? $.parseJSON( unitsString ): {},
						string = "",
						valuesString = "";

					//d3.format with added params to add arbitrary string at the end
					var customFormatter = function( formatString, suffix ) {
						var func = d3.format( formatString );
						return function( d, i ) {
							return func( d ) + suffix;
						};
					};

					//different popup setup for stacked area chart
					var unit = _.findWhere( units, { property: "y" } );
					if( unit && unit.format ) {
						var fixed = Math.min(20, parseInt(unit.format, 10)),
							unitName = ( unit.unit )? " " + unit.unit: "";
						that.chart.interactiveLayer.tooltip.valueFormatter( customFormatter("." + fixed + "f", unitName ) );
						//that.chart.interactiveLayer.tooltip.valueFormatter( d3.format("." + fixed + "f" ) );
					}
					
				}
				
				//set legend
				if( !App.ChartModel.get( "hide-legend" ) ) {
					//make sure wrapper is visible
					that.$svg.find( "> .nvd3.nv-custom-legend" ).show();
					that.legend = new App.Views.Chart.Legend( that.chart.legend ).vers( "owd" );
					that.legend.dispatch.on("addEntity", function() {
						if (that.$entitiesSelect.data("chosen")) {
							that.$entitiesSelect.data("chosen").active_field = false;
						}
						//trigger open the chosen drop down
						that.$entitiesSelect.trigger("chosen:open");
					} );
					that.svgSelection.call( that.legend );
					//put legend above chart

					//if stacked area chart
					if( chartType === App.ChartType.StackedArea ) {
						that.chart.stacked.dispatch.on( "areaMouseover", function( evt ) {
							that.legend.highlightPoint( evt );
						} );
						that.chart.stacked.dispatch.on( "areaMouseout", function( evt ) {
							that.legend.clearHighlight();
						} );
					}
				} else {
					//no legend, remove what might have previously been there
					that.$svg.find( "> .nvd3.nv-custom-legend" ).hide();
				}
				
				var dimensions = JSON.parse(App.ChartModel.get("chart-dimensions"));

				if( chartType == App.ChartType.ScatterPlot ) {
					//need to have own showDist implementation, cause there's a bug in nvd3
					that.scatterDist();
				}

				//if y axis has zero, display solid line
				var $pathDomain = $( ".nvd3 .nv-axis.nv-x path.domain" );
				if( yDomain[ 0 ] === 0 ) {
					$pathDomain.css( "stroke-opacity", "1" );
				} else {
					$pathDomain.css( "stroke-opacity", "0" );
				}
				
				var chartDimensionsString = App.ChartModel.get( "chart-dimensions" );
				if( chartDimensionsString.indexOf( '"property":"color"' ) === -1 ) {
					//check if string does not contain "property":"color"
					that.cacheColors( localData );
				}

				window.chart = that.chart;
				that.onResize();
				if (callback) callback();
			});

			this.localData = localData;
		},

		show: function() {
			this.$el.show();
		},

		hide: function() {
			this.$el.hide();
		},

		scatterDist: function() {

			var that = this,
				margins = App.ChartModel.get( "margins" ),
				nvDistrX = $( ".nv-distributionX" ).offset().top,
				svgSelection = d3.select( "svg" );

			that.chart.scatter.dispatch.on('elementMouseover.tooltip', function(evt) {
				var svgOffset = that.$svg.offset(),
					svgHeight = that.$svg.height();
				svgSelection.select('.nv-series-' + evt.seriesIndex + ' .nv-distx-' + evt.pointIndex)
					.attr('y1', evt.pos.top - nvDistrX );
				svgSelection.select('.nv-series-' + evt.seriesIndex + ' .nv-disty-' + evt.pointIndex)
					.attr('x2', evt.pos.left - svgOffset.left - margins.left );
				var position = {left: d3.event.clientX, top: d3.event.clientY };
				that.chart.tooltip.position(position).data(evt).hidden(false);
			});

		},

		splitSeriesByMissing: function(localData) {
			var lineType = App.ChartModel.get("line-type"),
				lineTolerance = parseInt(App.ChartModel.get("line-tolerance")) || 1,
				newData = [];

			_.each(localData, function(series) {
				var currentSeries = null;
				var currentMissing = null;

				_.each(series.values, function(d) {
					var isMissing = (d.gapYearsToNext && d.gapYearsToNext > lineTolerance);
					if (isMissing !== currentMissing) {
						if (currentSeries !== null) {
							// There's a single overlapping value to keep the lines joined
							currentSeries.values.push(d);
							newData.push(currentSeries);
						}
						currentSeries = _.extend({}, series, { values: [] });
						if (isMissing && lineType == App.LineType.DashedIfMissing)
							currentSeries.classed = 'dashed';
						else if (isMissing)
							currentSeries.classed = 'unstroked';
						currentMissing = isMissing;
					}

					currentSeries.values.push(d);
				});
			});

			// HACK (Mispy): Mutate the keys so nvd3 actually draws the new series.
			// Kludgy but necessary for now.
			var keys = {};
			_.each(newData, function(series, i) {
				series.origKey = series.key;
				if (keys[series.key]) {
					series.key = series.key + i;
					series.id = "copy-"+series.id;
					series.isCopy = true;
				} else
					keys[series.key] = true;
			});

			return newData;
		},

		scatterBubbleSize: function() {
			//set size of the bubbles depending on browser width
			var browserWidth = $( window ).width(),
				browserCoef = Math.max( 1, browserWidth / 1100 ),
				pointMin = 100 * Math.pow( browserCoef, 2 ),
				pointMax = 1000 * Math.pow( browserCoef, 2 );
			return [ pointMin, pointMax ];
		},

		checkStackedAxis: function() {

			//setting yAxisMax breaks expanded stacked chart, need to check manually
			var stackedStyle = this.chart.stacked.style(),
				yAxis = App.ChartModel.get( "y-axis" ),
				yAxisMin = ( yAxis[ "axis-min" ] || 0 ),
				yAxisMax = ( yAxis[ "axis-max" ] || null ),
				yDomain = [ yAxisMin, yAxisMax ];
			if( yAxisMax ) {
				//chart has set yAxis to max, depending on stacked style set max
				if( stackedStyle === "expand" ) {
					yDomain = [ 0, 1 ];
				}
				this.chart.yDomain( yDomain );
			}
			
		},


		onAvailableCountries: function( evt ) {
			var $select = $( evt.currentTarget ),
				val = $select.val(),
				$option = $select.find( "[value=" + val + "]" ),
				text = $option.text();

			if( !App.ChartModel.get( "group-by-variables" ) && App.ChartModel.get( "add-country-mode" ) === "add-country" ) {
				App.ChartModel.addSelectedCountry( { id: $select.val(), name: text } );
			} else {
				App.ChartModel.replaceSelectedCountry( { id: $select.val(), name: text } );
			}

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

		cacheColors: function( data ) {
			if( !this.cachedColors.length ) {
				var that = this;
				_.each( data, function( v, i ) {
					that.cachedColors[ v.id ] = v.color;
				} );
			}
		},

		assignColorFromCache: function( value ) {
			this.cachedColors = this.cachedColors || {};
			if( this.cachedColors.length ) {
				//assing color frome cache
				if( this.cachedColors[ value.id ] ) {
					value.color = this.cachedColors[ value.id ];
				} else {
					var randomColor = App.Utils.getRandomColor();
					value.color = randomColor;
					this.cachedColors[ value.id ] = randomColor;
				}
			} else if (!value.color && App.ChartModel.get("chart-type") == App.ChartType.LineChart) {
				this.colorScale = this.colorScale || nv.utils.getColor(d3.scale.category20().range());
				this.colorIndex = this.colorIndex || 0;
				value.color = this.colorScale(this.colorIndex += 1);	
			}
			return value;
		},

		onResize: function(callback) {
			if (_.isEmpty(this.localData)) {
				if (callback) callback();
				return;
			}
			
			if (this.legend) {
				this.svgSelection.call(this.legend);
			}

			//compute how much space for chart
			var margins = App.ChartModel.get("margins"),
				svg = d3.select(this.$svg[0]),
				svgBounds = svg.node().getBoundingClientRect(),
				tabBounds = $(".tab-pane.active").get(0).getBoundingClientRect(),
				chartOffsetY = tabBounds.top - svgBounds.top + parseFloat(margins.top) + 10,
				chartOffsetX = parseFloat(margins.left),
				// MISPY: The constant modifiers here are to account for nvd3 not entirely matching our specified dimensions
				chartHeight = tabBounds.height - parseFloat(margins.bottom) - parseFloat(margins.top) - 20 - 10,
				chartWidth = tabBounds.width - parseFloat(margins.left) - parseFloat(margins.right) + 60,
				chartType = App.ChartModel.get("chart-type");

			// Account for and position legend
			if (this.legend) {
				var legendMargins = this.legend.margin();
				this.translateString = "translate(" + legendMargins.left + " ," + chartOffsetY + ")";
				svg.select(".nvd3.nv-custom-legend").attr("transform", this.translateString);

				chartOffsetY += this.legend.height();
				chartHeight -= this.legend.height();
			}

			if (App.ChartModel.get("x-axis")["axis-label"]) {
				chartHeight -= 30;
			}

			// MISPY: These charts need a special offset because nvd3 doesn't seem
			// to count the controls as part of the width and height.
			if (chartType == App.ChartType.StackedArea || chartType == App.ChartType.MultiBar || chartType == App.ChartType.HorizontalMultiBar) {
				chartOffsetY += 20;
				if (chartType != App.ChartType.StackedArea)
					chartHeight -= 20;
			}

			// Make sure we actually have enough room for the chart to be visible!
			var minHeight = 150;
			if (chartHeight < minHeight) {
				var $wrapper = App.ChartView.$(".chart-wrapper-inner");
				$wrapper.css("height", $wrapper.height() + (minHeight-chartHeight) + 10 + "px");
				App.ChartView.onResize(callback, true);
				return;
			}

			// Inform nvd3 of the situation
			this.chart.width(chartWidth);
			this.chart.height(chartHeight);
			this.chart.update();

			var wrap = svg.select(".nvd3.nv-wrap");
			this.translateString = "translate(" + chartOffsetX + "," + chartOffsetY + ")";
			wrap.attr("transform", this.translateString);

			// Move controls up for multibar chart
			if (chartType == App.ChartType.MultiBar || chartType == App.ChartType.HorizontalMultiBar) {
				d3.select( ".nv-controlsWrap" ).attr( "transform", "translate(0,-30)" );
			}

			/*if (chartType == App.ChartType.StackedArea) {
				//for stacked area chart, need to manually adjust height
				var currIntLayerHeight = this.chart.interactiveLayer.height(),
					//TODO - do not hardcode this
					heightAdd = 150;
				this.chart.interactiveLayer.height( currIntLayerHeight + heightAdd );
				d3.select(".nv-interactive").call(this.chart.interactiveLayer);
				//and add extra offset to of the .nv-wrap to account for Stacked and Expanded controls
				chartOffsetY += 20;
			}*/

			//for multibarchart, need to move controls bit higher



			//position scale dropdowns - TODO - isn't there a better way then with timeout?
			setTimeout(function() {
				var chartRect = svg.select(".nvd3 g > rect"),
					chartBounds = chartRect.node().getBoundingClientRect(),
					offsetX = chartBounds.left - svgBounds.left,
					offsetY = 0;

				this.$xAxisScaleSelector.css({ left: offsetX + chartBounds.width, top: offsetY + chartBounds.height });
				this.$yAxisScaleSelector.css({ left: offsetX, top: offsetY });
			}.bind(this), 250);

			if (_.isFunction(callback)) callback();
		}					
	} );

})();