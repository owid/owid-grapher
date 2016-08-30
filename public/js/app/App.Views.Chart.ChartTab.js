;(function() {
	"use strict";
	owid.namespace("App.Views.Chart.ChartTab");
	owid.namespace("owid.tab.chart");

	// Override nvd3 handling of zero data charts to prevent it removing
	// all of our svg stuff
	nv.utils.noData = function(nvd3, container) {
	    container.selectAll('g.nv-wrap').remove();
	    App.ChartView.handleMissingData("No data available.");
	};

	owid.tab.chart = function(chart) {
		function chartTab() { }
		var changes = owid.changes();
		changes.track(chart.model);
		changes.track(chart.data);
		changes.track(chart.display);

		var $svg, $tab, $entitiesSelect,
			$xAxisScale, $xAxisScaleSelector,
			$yAxisScale, $yAxisScaleSelector,
			svg, nvd3;

		var chartType, localData, missingMsg, lineType;

		var legend = new App.Views.Chart.Legend();

		var xAxis = chart.model.get("x-axis"),
			yAxis = chart.model.get("y-axis"),
			xAxisPrefix = xAxis["axis-prefix"] || "",
			xAxisSuffix = xAxis["axis-suffix"] || "",
			yAxisPrefix = yAxis["axis-prefix"] || "",
			yAxisSuffix = yAxis["axis-suffix"] || "",
			xAxisLabelDistance = +xAxis["axis-label-distance"] || 0,
			yAxisLabelDistance = +yAxis["axis-label-distance"] || 0,
			xAxisMin = xAxis["axis-min"] || null,
			xAxisMax = xAxis["axis-max"] || null,
			yAxisMin = yAxis["axis-min"] || 0,
			yAxisMax = yAxis["axis-max"] || null,
			xAxisScale = xAxis["axis-scale"] || "linear",
			yAxisScale = yAxis["axis-scale"] || "linear",
			xAxisFormat = xAxis["axis-format"],
			yAxisFormat = yAxis["axis-format"] || 5;

		var xDomain, yDomain, isClamped;

		var nvOptions = {
			showLegend: false
		};

		chartTab.cleanup = function() {
			$svg.attr("class", "");

			chart.model.off(null, null, this);
			d3.selectAll(".nvd3").remove();
			if ($yAxisScaleSelector)
				$yAxisScaleSelector.hide();
			d3.selectAll("svg").on("mousemove.stackedarea", null);
		},

		chartTab.render = function() {
			if (!changes.any()) return;
			console.trace('chartTab.render');

			configureTab();
			configureData();
			configureAxis();
			configureBounds();

			$(".chart-error").remove();
			if (missingMsg || _.isEmpty(localData)) {
				$tab.find(".nv-wrap").remove();
				chart.showMessage(missingMsg || "No available data.");
				return;
			}

			updateAvailableCountries();

			// Initialize or update the nvd3 graph
			nv.addGraph(function() {
				renderLegend();

				if (chartType == App.ChartType.LineChart) {
					renderLineChart();
				} else if (chartType == App.ChartType.ScatterPlot) {
					renderScatterPlot();
				} else if (chartType == App.ChartType.StackedArea) {
					renderStackedArea();
				} else if (chartType == App.ChartType.MultiBar || chartType == App.ChartType.HorizontalMultiBar) {	
					renderMultiBar();
				} else if (chartType == App.ChartType.DiscreteBar) {
					renderDiscreteBar();
				}

				nvd3.width(chartWidth);
				nvd3.height(chartHeight);
				nvd3.margin({ left: +margins.left, top: +margins.top, right: +margins.right + 20, bottom: +margins.bottom + 20 });
				nvd3.dispatch.on("renderEnd", postRender);

				renderAxis();
				renderTooltips();

				if (chartType == App.ChartType.LineChart && (lineType == App.LineType.DashedIfMissing))
					localData = splitSeriesByMissing(localData);
				
				svg.datum(localData).call(nvd3);

				if (chartType == App.ChartType.ScatterPlot) {
					//need to have own showDist implementation, cause there's a bug in nvd3
//					scatterDist();
				}
				window.nvd3 = nvd3;

				changes.take();


				var nvWrap = d3.select('.nvd3.nv-wrap > g');
				nvWrap.attr('transform', 'translate(' + chartOffsetX + ',' + chartOffsetY + ')');			
			});
		};

		function configureTab() {
			if (!changes.any('activeTab chart-type'))
				return;

			chartType = chart.model.get('chart-type');
			$svg = chart.$("svg");
			svg = d3.select($svg.get(0));
			$svg.attr("class", "nvd3-svg " + chartType);
			$tab = chart.$("#chart-chart-tab");
			$entitiesSelect = $tab.find('[name=available_entities]');
			$xAxisScaleSelector = $tab.find('.x-axis-scale-selector');
			$xAxisScale = $tab.find('[name=x_axis_scale]');
			$yAxisScaleSelector = $tab.find('.y-axis-scale-selector');
			$yAxisScale = $tab.find('[name=y_axis_scale]');
		}

		function configureData() {
			localData = chart.data.transformData();
			missingMsg = chart.model.checkMissingData();

			// Add classes to the series so we can style e.g. the World line differently
			_.each(localData, function(d) {
				d.classed = owid.makeSafeForCSS(d.key);
			});

			lineType = chart.model.get('line-type');
		}

		function configureAxis() {
			if (!changes.any('x-axis y-axis'))
				return;

			xAxis = chart.model.get("x-axis");
			yAxis = chart.model.get("y-axis");
			xAxisPrefix = xAxis["axis-prefix"] || "";
			xAxisSuffix = xAxis["axis-suffix"] || "";
			yAxisPrefix = yAxis["axis-prefix"] || "";
			yAxisSuffix = yAxis["axis-suffix"] || "";
			xAxisLabelDistance = +xAxis["axis-label-distance"] || 0;
			yAxisLabelDistance = +yAxis["axis-label-distance"] || 0;
			xAxisMin = xAxis["axis-min"] || null;
			xAxisMax = xAxis["axis-max"] || null;
			yAxisMin = yAxis["axis-min"] || 0;
			yAxisMax = yAxis["axis-max"] || null;
			xAxisScale = xAxis["axis-scale"] || "linear";
			yAxisScale = yAxis["axis-scale"] || "linear";
			xAxisFormat = xAxis["axis-format"];
			yAxisFormat = yAxis["axis-format"] || 5;				
		}

		var margins, svgBounds, tabBounds, chartOffsetX, chartOffsetY,
			chartWidth, chartHeight;

		function configureBounds() {
  		    margins = chart.model.get("margins");
			svgBounds = svg.node().getBoundingClientRect();
			tabBounds = $(".tab-content").get(0).getBoundingClientRect();
			chartOffsetX = 0;//parseFloat(margins.left);
			chartOffsetY = tabBounds.top - svgBounds.top;// + parseFloat(margins.top) + 10;
			// MISPY: The constant modifiers here are to account for nvd3 not entirely matching our specified dimensions
			chartHeight = tabBounds.height; //- parseFloat(margins.bottom) - parseFloat(margins.top);
			chartWidth = tabBounds.width; //- parseFloat(margins.left) - parseFloat(margins.right);
		}

		function updateAvailableCountries() {
			var availableEntities = App.VariableData.get("availableEntities"),
				selectedEntitiesById = chart.model.getSelectedEntitiesById(),
				entityType = chart.model.get("entity-type");

			// Fill entity selector with all entities not currently selected
			$entitiesSelect.empty();
			$entitiesSelect.append("<option disabled selected>Select " + entityType + "</option>");
			_.each(availableEntities, function(entity) {
				if (!selectedEntitiesById[entity.id]) {
					$entitiesSelect.append("<option value='" + entity.id + "'>" + entity.name + "</option>");
				}
			});

			$entitiesSelect.trigger("chosen:updated");
			$entitiesSelect.off('change').on('change', onAvailableCountries);
		}

		function onAvailableCountries(evt) {
			var $select = $(evt.currentTarget),
				val = $select.val(),
				$option = $select.find("[value=" + val + "]"),
				text = $option.text();

			if (chart.model.get("add-country-mode") === "add-country") {
				chart.model.addSelectedCountry({ id: $select.val(), name: text });
			} else {
				chart.model.replaceSelectedCountry({ id: $select.val(), name: text });
			}
		}

		function renderLineChart() {
			var lineType = chart.model.get("line-type");
			if (lineType == App.LineType.WithDots || lineType == App.LineType.DashedIfMissing) {
				$svg.addClass("line-dots");
			} else {
				$svg.removeClass("line-dots");
			}

			nvd3 = nv.models.lineChart().options(nvOptions);			
		}

		function renderScatterPlot() {
			//set size of the bubbles depending on browser width
			var browserWidth = $(window).width(),
				browserCoef = Math.max( 1, browserWidth / 1100 ),
				pointMin = 100 * Math.pow( browserCoef, 2 ),
				pointMax = 1000 * Math.pow( browserCoef, 2 );
			var points = [pointMin, pointMax];

			nvd3 = nv.models.scatterChart().options(nvOptions).pointRange(points).showDistX(true).showDistY(true);			
		}

		function renderStackedArea() {
			// TODO put this in ChartData - mispy
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

			nvOptions.showTotalInTooltip = true;

			nvd3 = nv.models.stackedAreaChart()
				.options(nvOptions)
				.controlOptions(["Stacked", "Expanded"])
				.controlLabels({
					"stacked": "Absolute",
					"expanded": "Relative"
				})
				.useInteractiveGuideline(true)
				.x(function(d) { return d.x; })
				.y(function(d) { return d.y; });

			if (chart.model.get("currentStackMode") == "relative")
				nvd3.style("expand");			
		}

		function renderMultiBar() {
			if (changes.any('chartData')) {
				console.trace('change chartData');
				// MISPY TODO - move this into ChartData
				// relevant test chart: http://ourworldindata.org/grapher/public-health-insurance-coverage2?stackMode=stacked
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
		                    if( valuesCheck[ serie.id ] && !valuesCheck[serie.id][time]) {
		                        //time doesn't existig for given entity, i
		                        var zeroObj = {
		                            "key": serie.key,
		                            "serie": serieIndex,
		                            "time": time,
		                            "x": time,
		                            "y": 0,
		                            "fake": true
		                        };
		                        serie.values.splice( timeIndex, 0, zeroObj);
		                    }
		                });    
		            });
		        }

				if (chartType == App.ChartType.MultiBar) {
					nvd3 = nv.models.multiBarChart().options(nvOptions);					
				} else if (chartType == App.ChartType.HorizontalMultiBar) {
					nvd3 = nv.models.multiBarHorizontalChart().options(nvOptions);					
				}				
			}

			if (chart.model.get("currentStackMode") == "stacked")
				nvd3.stacked(true);			
			else
				nvd3.stacked(false);			
		}

		function renderDiscreteBar() {
			nvOptions.showValues = true;

			nvd3 = nv.models.discreteBarChart()
				.x(function(d) { return d.x; })
				.y(function(d) { return d.y; })
				.options(nvOptions);

			// MISPY: nvd3 workaround hack
			nv.dispatch.on("render_end", function() {
				setTimeout(postRender, 500);
			});
		}

		function renderTooltips() {
			if (chartType == App.ChartType.StackedArea)
				nvd3.interactiveLayer.tooltip.contentGenerator(owid.contentGenerator);
			else
				nvd3.tooltip.contentGenerator(owid.contentGenerator);
		}

		function renderAxis() {
			$xAxisScaleSelector.toggle(chart.model.get('x-axis-scale-selector'));
			$yAxisScaleSelector.toggle(chart.model.get('y-axis-scale-selector'));

			nvd3.xAxis
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
				} else if(_.isArray(v)) {
					//special case for discrete bar chart
					allValues = v;
				}
			} );

			//domain setup
			xDomain = d3.extent( allValues.map( function( d ) { return d.x; } ) ),
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
				if( chartType !== App.ChartType.MultiBar && chartType !== App.ChartType.HorizontalMultiBar && chartType !== App.ChartType.DiscreteBar ) {
					//version which makes sure min/max values are present, but will display values outside of the range
					nvd3.forceX( xDomain );
					nvd3.forceY( yDomain );
				}
			}

			if (yAxisScale === "linear") {
				nvd3.yScale(d3.scale.linear());
			} else if( yAxisScale === "log" ) {
				nvd3.yScale(d3.scale.log());

				// MISPY: Custom calculation of axis ticks, since nvd3 doesn't
				// account for log scale when doing its own calc and that can result in
				// overlapping axis labels.
				var minPower10 = Math.ceil(Math.log(yDomain[0]) / Math.log(10));
				var maxPower10 = Math.floor(Math.log(yDomain[1]) / Math.log(10));

				var tickValues = [];
				for (var i = minPower10; i <= maxPower10; i++) {
					tickValues.push(Math.pow(10, i));
				}
				nvd3.yAxis.tickValues(tickValues);
			}

			nvd3.yAxis
				.axisLabel(yAxis["axis-label"])
				.axisLabelDistance(yAxisLabelDistance)
				.tickFormat(function(d) { return yAxisPrefix + owid.unitFormat({ format: yAxisFormat }, d) + yAxisSuffix; })
				.showMaxMin(false);

			//scatter plots need more ticks
			if (chartType === App.ChartType.ScatterPlot) {
				nvd3.xAxis.ticks(7);
				nvd3.yAxis.ticks(7);
			}

			//if y axis has zero, display solid line
			var $pathDomain = $(".nvd3 .nv-axis.nv-x path.domain");
			if (yDomain[0] === 0) {
				$pathDomain.css("stroke-opacity", "1");
			} else {
				$pathDomain.css("stroke-opacity", "0");
			}
		}

		function renderLegend() {
			if (!chart.model.get("hide-legend")) {
				legend.dispatch.on("addEntity", function() {
					if ($entitiesSelect.data("chosen")) {
						$entitiesSelect.data("chosen").active_field = false;
					}
					$entitiesSelect.trigger("chosen:open");
				});

				legend.render();

				var translateString = "translate(" + 0 + " ," + (chartOffsetY+20) + ")";
				svg.select(".nvd3.nv-custom-legend").attr("transform", translateString);
				chartOffsetY += legend.height() + 10;
				chartHeight -= legend.height() + 10;
			} else {
				$svg.find("> .nvd3.nv-custom-legend").hide();
			}			
		}

		function splitSeriesByMissing(localData) {
			var lineType = chart.model.get("line-type"),
				lineTolerance = parseInt(chart.model.get("line-tolerance")) || 1,
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
		}

		function postRender() {
			// Hijack the nvd3 mode switch to store it
			$(".nv-controlsWrap .nv-series").off("click");
			$(".nv-controlsWrap .nv-series").on("click", function(ev) {
				chart.model.set("currentStackMode", $(ev.target).text().toLowerCase(), { noRender: true });
			});

			if (chartType == App.ChartType.StackedArea) {
				// Stop the tooltip from overlapping the chart controls
				d3.selectAll("svg").on("mousemove.stackedarea", function() {
					var $target = $(d3.event.target);
					if (!$target.is("rect, path") || $target.closest(".nv-custom-legend").length)
						nvd3.interactiveLayer.tooltip.hidden(true);							
				});

				// Override default stacked area click behavior
				d3.selectAll(".nv-area").on("click", function(d) {
					chart.model.focusToggleLegendKey(d.key);
				});
			}										

			$(window).trigger('chart-loaded');
		}

		return chartTab;
	};


	App.Views.Chart.ChartTabu = owid.View.extend({
		el: "#chart",
		events: {
		},


		update: function() {
			chart.data.ready(function() {
				if (needsFullRender) {	
					deactivate();
					activate();
				} else {
					render(onResize.bind(this));					
				}
			}.bind(this));
		},

		render: function(callback) {


			localData = localData;
		},

		show: function() {
			$tab.show();
		},

		hide: function() {
			$tab.hide();
		},

		scatterDist: function() {
			if (!$(".nv-distributionX").length) return;

			var that = this,
				margins = chart.model.get( "margins" ),
				nvDistrX = $( ".nv-distributionX" ).offset().top,
				svgSelection = d3.select( "svg" );

			nvd3.scatter.dispatch.on('elementMouseover.tooltip', function(evt) {
				var svgOffset = $svg.offset(),
					svgHeight = $svg.height();
				svgSelection.select('.nv-series-' + evt.seriesIndex + ' .nv-distx-' + evt.pointIndex)
					.attr('y1', evt.pos.top - nvDistrX );
				svgSelection.select('.nv-series-' + evt.seriesIndex + ' .nv-disty-' + evt.pointIndex)
					.attr('x2', evt.pos.left - svgOffset.left - margins.left );
				var position = {left: d3.event.clientX, top: d3.event.clientY };
				nvd3.tooltip.position(position).data(evt).hidden(false);
			});
		},


		scatterBubbleSize: function() {
		},

		checkStackedAxis: function() {
			//setting yAxisMax breaks expanded stacked chart, need to check manually
			var stackedStyle = chart.stacked.style(),
				yAxis = chart.model.get( "y-axis" ),
				yAxisMin = ( yAxis[ "axis-min" ] || 0 ),
				yAxisMax = ( yAxis[ "axis-max" ] || null ),
				yDomain = [ yAxisMin, yAxisMax ];
			if( yAxisMax ) {
				//chart has set yAxis to max, depending on stacked style set max
				if( stackedStyle === "expand" ) {
					yDomain = [ 0, 1 ];
				}
				chart.yDomain( yDomain );
			}
		},

		onResize: function(callback) {			
			if (legend) legend.render();

			//compute how much space for chart
			var margins = chart.model.get("margins"),
				svg = d3.select($svg[0]),
				svgBounds = svg.node().getBoundingClientRect(),
				tabBounds = $(".tab-pane.active").get(0).getBoundingClientRect(),
				chartOffsetY = tabBounds.top - svgBounds.top + parseFloat(margins.top),
				chartOffsetX = parseFloat(margins.left),
				// MISPY: The constant modifiers here are to account for nvd3 not entirely matching our specified dimensions
				chartHeight = tabBounds.height - parseFloat(margins.bottom) - parseFloat(margins.top),
				chartWidth = tabBounds.width - parseFloat(margins.left) - parseFloat(margins.right),
				chartType = chart.model.get("chart-type");

			// Account for and position legend
			if (legend) {
				translateString = "translate(" + 0 + " ," + chartOffsetY + ")";
				svg.select(".nvd3.nv-custom-legend").attr("transform", translateString);

				chartOffsetY += legend.height() + 10;
				chartHeight -= legend.height() + 10;
			}

			if (chart.model.get("x-axis")["axis-label"]) {
				chartHeight -= 30;
			}

			// MISPY: These charts need a special offset because nvd3 doesn't seem
			// to count the controls as part of the width and height.
			if (chartType == App.ChartType.StackedArea || chartType == App.ChartType.MultiBar || chartType == App.ChartType.HorizontalMultiBar) {
				chartOffsetY += 20;
				if (chartType != App.ChartType.StackedArea)
					chartHeight -= 20;
			}

			// Inform nvd3 of the situation
			if (chart && !$(".chart-error").is(":visible")) {
				chart.update();				
			}

			var wrap = svg.select(".nvd3.nv-wrap");
			translateString = "translate(" + chartOffsetX + "," + chartOffsetY + ")";
			wrap.attr("transform", translateString);

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
					offsetY = (legend ? legend.height() + 5 : 0);

				$xAxisScaleSelector.css({ left: offsetX + chartBounds.width, top: offsetY + chartBounds.height });
				$yAxisScaleSelector.css({ left: offsetX, top: offsetY-3 });
			}.bind(this), 250);

			if (_.isFunction(callback)) callback();
		}					
	} );

})();