;(function() {
	"use strict";
	owid.namespace("App.Views.Chart.ChartTab");

	// Override nvd3 handling of zero data charts to prevent it removing
	// all of our svg stuff
	nv.utils.noData = function(chart, container) {
	    var opt = chart.options(),
	        margin = opt.margin(),
	        height = nv.utils.availableHeight(opt.height(), container, margin),
	        width = nv.utils.availableWidth(opt.width(), container, margin),
	        x = margin.left + width/2,
	        y = margin.top + height/2;

	    //Remove any previously created chart components
	    container.selectAll('g.nv-wrap').remove();

	    var chartType = App.ChartModel.get("chart-type");

	    var msg = "No data available.";
	    if (!App.ChartModel.hasVariables())
	    	msg = "No variables have been added.";
	    else if (!App.ChartModel.hasEntities() && chartType != App.ChartType.ScatterPlot) 
	    	msg = "No " + App.ChartModel.get("entity-type") + " selected.";

	    var noDataText = container.selectAll('.nv-noData').data([msg]);

	    noDataText.enter().append('text')
	        .attr('class', 'nvd3 nv-noData')
	        .attr('dy', '-.7em')
	        .style('text-anchor', 'middle');

	    noDataText
	        .attr('x', x)
	        .attr('y', y)
	        .text(function(t){ return t; });
	};

	App.Views.Chart.ChartTab = owid.View.extend({
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

		activate: function(callback) {
			this.delegateEvents();

			this.$svg = $("svg");
			this.$svg.attr("class", "nvd3-svg");
			this.$entitiesSelect = this.$el.find( "[name=available_entities]" );
			this.$xAxisScaleSelector = this.$el.find( ".x-axis-scale-selector" );
			this.$xAxisScale = this.$el.find( "[name=x_axis_scale]" );
			this.$yAxisScaleSelector = this.$el.find( ".y-axis-scale-selector" );
			this.$yAxisScale = this.$el.find( "[name=y_axis_scale]" );
			this.$reloadBtn = this.$el.find( ".reload-btn" );
			var chartTime = App.ChartModel.get("chart-time");

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

			this.listenTo(App.ChartModel, "change:chart-type", function() { this.needsFullRender = true; }.bind(this));
			this.listenTo(App.ChartModel, "change", this.update.bind(this));
			this.render(callback);
		},

		deactivate: function() {
			App.ChartModel.off(null, null, this);
			d3.selectAll(".nvd3").remove();
			if (this.$yAxisScaleSelector)
				this.$yAxisScaleSelector.show();
			d3.selectAll("svg").on("mousemove.stackedarea", null);
		},

		update: function() {
			App.DataModel.ready(function() {
				if (this.needsFullRender) {	
				this.deactivate();
					this.activate();
				} else {
					this.render(this.onResize.bind(this));					
				}
			}.bind(this));
		},

		updateAvailableCountries: function() {
			var availableEntities = App.VariableData.get("availableEntities"),
				selectedCountries = App.ChartModel.get("selected-countries"),
				selectedCountriesIds = _.map(selectedCountries, function(v) { return (v)? +v.id: ""; }),
				entityType = App.ChartModel.get("entity-type");

			// Fill entity selector with all entities not currently selected
			this.$entitiesSelect.empty();
			this.$entitiesSelect.append("<option disabled selected>Select " + entityType + "</option>");
			_.each(availableEntities, function(entity) {
				if (!_.contains(selectedCountriesIds, +entity.id)) {
					this.$entitiesSelect.append("<option value='" + entity.id + "'>" + entity.name + "</option>");
				}
			}.bind(this));

			this.$entitiesSelect.trigger("chosen:updated");
		},

		render: function(callback) {
			var localData = App.DataModel.transformData(),
				chartType = App.ChartModel.get("chart-type"),
				svg = d3.select("svg");

			this.updateAvailableCountries();

			var that = this;

			var chartType = App.ChartModel.get( "chart-type" );

			//filter data for selected countries
			var selectedCountries = App.ChartModel.get("selected-countries");

			var selectedCountriesById = [],
				selectedCountriesIds = _.map( selectedCountries, function(v) {
					//store
					selectedCountriesById[ v.id ] = v;
					return +v.id;
				} );

			// For stacked area chart, the order of the series matters. For other chart
			// types we sort them alphabetically.
			if (chartType == App.ChartType.StackedArea) {
			} else {
				localData = _.sortBy(localData, function(obj) { return obj.key; });
			}
			
			// Add classes to the series so we can style e.g. the World line differently
			_.each(localData, function(d) {
				d.classed = owid.makeSafeForCSS(d.key);
			});

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
				xAxisFormat = xAxis["axis-format"],
				yAxisFormat = yAxis["axis-format"] || 5;

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

					if (App.ChartModel.get("currentStackMode") == "relative")
						that.chart.style("expand");			

				} else if (chartType == App.ChartType.MultiBar || chartType == App.ChartType.HorizontalMultiBar) {
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
						valuesCheck[v.id] = entityData;
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

					if (chartType == App.ChartType.MultiBar) {
						that.chart = nv.models.multiBarChart().options(chartOptions);					
					} else if (chartType == App.ChartType.HorizontalMultiBar) {
						that.chart = nv.models.multiBarHorizontalChart().options(chartOptions);					
					}
				} else if (chartType == App.ChartType.DiscreteBar) {
					chartOptions.showValues = true;

					that.chart = nv.models.discreteBarChart()
						.x(function(d) { return d.x; })
						.y(function(d) { return d.y; })
						.options(chartOptions);					
				}

				that.chart.dispatch.on("renderEnd", function(state) {
					$(window).trigger('chart-loaded');

					/* HACK (Mispy): Hijack nvd3 mode switch for stacked area charts. */
					if (chartType == App.ChartType.StackedArea) {
						d3.selectAll(".nv-controlsWrap .nv-series").on("click", function(opt) {
							if (opt.key == "Relative") {
								App.ChartModel.set("currentStackMode", "relative");
							} else {
								App.ChartModel.set("currentStackMode", "absolute");
							}
						});
	
						// Stop the tooltip from overlapping the chart controls
						d3.selectAll("svg").on("mousemove.stackedarea", function() {
							var $target = $(d3.event.target);
							if (!$target.is("rect, path") || $target.closest(".nv-custom-legend").length)
								that.chart.interactiveLayer.tooltip.hidden(true);							
						});
					}
				});			

				if (chartType != App.ChartType.DiscreteBar) {
					that.chart.dispatch.on("stateChange", function() {
						/* HACK (Mispy): Ensure stacked area charts maintain the correct dimensions on 
						 * transition between stacked and expanded modes. It cannot be done on renderEnd
						 * or stateChange because the delay causes the chart to jump; overriding update
						 * seems to be the only way to get it to synchronously flow into resizing. It must
						 * be re-overridden in stateChange because the nvd3 chart render function resets it. Note
						 * that stacked area charts also pay no attention to the margin setting. */
						var origUpdate = that.chart.update;
						that.chart.update = function() {
							origUpdate.call(that.chart);
							that.onResize();
						};
					});					
				}
	
				//fixed probably a bug in nvd3 with previous tooltip not being removed
				d3.select( ".xy-tooltip" ).remove();

				that.chart.xAxis
					.axisLabel(xAxis["axis-label"])
					.axisLabelDistance(xAxisLabelDistance)
					.tickFormat(function(d) {
						if (chartType == App.ChartType.ScatterPlot) {
							return xAxisPrefix + owid.unitFormat({ format: xAxisFormat }, d) + xAxisSuffix;
						} else if (chartType == App.ChartType.DiscreteBar) {
							return d;
						} else {
							return App.Utils.formatTimeLabel("Year", d, xAxisPrefix, xAxisSuffix, xAxisFormat );
						}
					});

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
					}
				}

				if (yAxisScale === "linear") {
					that.chart.yScale(d3.scale.linear());
				} else if( yAxisScale === "log" ) {
					that.chart.yScale(d3.scale.log());

					// MISPY: Custom calculation of axis ticks, since nvd3 doesn't
					// account for log scale when doing its own calc and that can result in
					// overlapping axis labels.
					var minPower10 = Math.ceil(Math.log(yDomain[0]) / Math.log(10));
					var maxPower10 = Math.floor(Math.log(yDomain[1]) / Math.log(10));

					var tickValues = [];
					for (var i = minPower10; i <= maxPower10; i++) {
						tickValues.push(Math.pow(10, i));
					}
					that.chart.yAxis.tickValues(tickValues);
				}

				if (chartType == App.ChartType.MultiBar || chartType === App.ChartType.HorizontalMultiBar) {
					//for multibar chart, x axis has ordinal scale, so need to setup domain properly
					//that.chart.xDomain( d3.range(xDomain[0], xDomain[1] + 1) );
					that.chart.xDomain(allTimes);
				}

				that.chart.yAxis
					.axisLabel(yAxis["axis-label"])
					.axisLabelDistance(yAxisLabelDistance)
					.tickFormat(function(d) { return yAxisPrefix + owid.unitFormat({ format: yAxisFormat }, d) + yAxisSuffix; })
					.showMaxMin(false);

				//scatter plots need more ticks
				if( chartType === App.ChartType.ScatterPlot ) {
					//hardcode
					that.chart.xAxis.ticks(7);
					that.chart.yAxis.ticks(7);
				}


				window.localData = localData;

				var displayData = localData;
				if (chartType == App.ChartType.LineChart && (lineType == App.LineType.DashedIfMissing))// || lineType == App.LineType.UnjoinedIfMissing))
					displayData = that.splitSeriesByMissing(localData);
				window.displayData = displayData;
				that.svgSelection = d3.select(that.$svg.selector)
					.datum(displayData)
					.call(that.chart);

				if (chartType == App.ChartType.StackedArea)
					that.chart.interactiveLayer.tooltip.contentGenerator(owid.contentGenerator);
				else
					that.chart.tooltip.contentGenerator(owid.contentGenerator);
				
				//set legend
				if (!App.ChartModel.get("hide-legend")) {
					that.$svg.find("> .nvd3.nv-custom-legend").show();
					that.legend = new App.Views.Chart.Legend(that.chart.legend);
					that.legend.dispatch.on("addEntity", function() {
						if (that.$entitiesSelect.data("chosen")) {
							that.$entitiesSelect.data("chosen").active_field = false;
						}
						//trigger open the chosen drop down
						that.$entitiesSelect.trigger("chosen:open");
					});
					that.legend.render();
				} else {
					//no legend, remove what might have previously been there
					that.$svg.find("> .nvd3.nv-custom-legend").hide();
					that.legend = null;
				}
				
				var dimensions = App.ChartModel.getDimensions();

				if (chartType == App.ChartType.ScatterPlot) {
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

				window.chart = that.chart;
				that.onResize();
				if (_.isFunction(callback)) callback();
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
			if (!$(".nv-distributionX").length) return;

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

		onAvailableCountries: function(evt) {
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

		onResize: function(callback) {			
			if (this.legend) this.legend.render();

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
				this.translateString = "translate(" + 0 + " ," + chartOffsetY + ")";
				svg.select(".nvd3.nv-custom-legend").attr("transform", this.translateString);

				chartOffsetY += this.legend.height() + 10;
				chartHeight -= this.legend.height() + 10;
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

			//position scale dropdowns - TODO - isn't there a better way then with timeout?
			setTimeout(function() {
				var chartRect = svg.select(".nv-wrap g > rect");
				if (chartRect.empty()) return;

				var chartBounds = chartRect.node().getBoundingClientRect(),
					offsetX = chartBounds.left - svgBounds.left + 5,
					offsetY = (this.legend ? this.legend.height() + 5 : 0);

				this.$xAxisScaleSelector.css({ left: offsetX + chartBounds.width, top: offsetY + chartBounds.height });
				this.$yAxisScaleSelector.css({ left: offsetX, top: offsetY });
			}.bind(this), 250);

			if (_.isFunction(callback)) callback();
		}					
	} );

})();