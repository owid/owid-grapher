;(function() {
	"use strict";
	owid.namespace("owid.tab.chart");

	// Override nvd3 handling of zero data charts to prevent it removing
	// all of our svg stuff
	nv.utils.noData = function(nvd3, container) {
	    container.selectAll('g.nv-wrap').remove();
	    chart.showMessage("No data available.");
	};

	owid.tab.chart = function(chart) {
		function chartTab() { }
		var changes = owid.changes();
		changes.track(chart.model);
		changes.track(chart.data);
		changes.track(chart.display);

		var $svg, $tab, $entitiesSelect,
			$xAxisScale, $yAxisScale,
			svg, nvd3, viz;

		var chartType, localData, missingMsg, lineType;

		var legend = new App.Views.Chart.Legend();
		chartTab.legend = legend;

		var timeline;

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

		chartTab.scaleSelectors = owid.view.scaleSelectors(chart);

		var nvOptions = {
			showLegend: false
		};

		chartTab.deactivate = function() {
			if (!$svg) return;
			viz = null;			
			$svg.attr("class", "");

			chart.model.off(null, null, this);
			d3.selectAll(".nvd3, .axisBox, .nvtooltip:not(.owid-tooltip)").remove();
			chartTab.scaleSelectors.hide();
			d3.selectAll("svg").on("mousemove.stackedarea", null);
			changes.done();
		},

		chartTab.render = function() {
			if (!changes.start()) return;
			console.trace('chartTab.render');

			configureTab();
			configureData();
			configureAxis();
			configureBounds();
			renderLegend();
//			renderTimeline();

			$(".chart-error").remove();
			if (missingMsg || (_.isEmpty(localData) && chartType != App.ChartType.ScatterPlot)) {
				chart.$(".nv-wrap").remove();
				chart.showMessage(missingMsg || "No available data.");
				return changes.done();
			}

			updateAvailableCountries();

			// Initialize or update the nvd3 graph

			function updateGraph() {
				if (chartType == App.ChartType.LineChart && (lineType == App.LineType.DashedIfMissing))
					localData = splitSeriesByMissing(localData);

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

				if (nvd3) {
					nvd3.width(chartWidth);
					nvd3.height(chartHeight);
					var marginBottom = +margins.bottom + 20;
					if (chartType == App.ChartType.ScatterPlot || chartType == App.ChartType.MultiBar || chartType == App.ChartType.DiscreteBar)
						marginBottom += 10;
					nvd3.margin({ left: +margins.left + 10, top: +margins.top, right: +margins.right + 20, bottom: marginBottom });
					nv.dispatch.on("render_end", function() {
						setTimeout(postRender, 500);
					});
					window.nvd3 = nvd3;
				}

				renderAxis();
				renderTooltips();
				
				if (nvd3) {
					svg.datum(localData).call(nvd3);
		
					var nvWrap = d3.select('.nvd3.nv-wrap > g');
					nvWrap.attr('transform', 'translate(' + chartOffsetX + ',' + chartOffsetY + ')');		
					$('.nvtooltip:not(.owid-tooltip)').remove();

					//if y axis has zero, display solid line
					var $pathDomain = $(".nvd3 .nv-axis.nv-x path.domain");
					if (yDomain[0] === 0) {
						$pathDomain.css("stroke-opacity", "1");
					} else {
						$pathDomain.css("stroke-opacity", "0");
					}					
				}

				ensureLabelsFit();				
				changes.done();	
			}

			if (!nvd3 && chartType != App.ChartType.ScatterPlot)
				nv.addGraph(updateGraph);
			else
				updateGraph();
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
  		    margins = _.clone(chart.model.get("margins"));
			svgBounds = chart.getBounds(svg.node());
			tabBounds = chart.getBounds($(".tab-content").get(0));
			chartOffsetX = 0;//parseFloat(margins.left);
			chartOffsetY = tabBounds.top - svgBounds.top;// + parseFloat(margins.top) + 10;
			// MISPY: The constant modifiers here are to account for nvd3 not entirely matching our specified dimensions
			chartHeight = tabBounds.height; //- parseFloat(margins.bottom) - parseFloat(margins.top);
			chartWidth = tabBounds.width; //- parseFloat(margins.left) - parseFloat(margins.right);
		}

		function updateAvailableCountries() {
			if (chartType == App.ChartType.ScatterPlot) return;

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
				chart.$chart.addClass("line-dots");
			} else {
				chart.$chart.removeClass("line-dots");
			}

			nvd3 = nv.models.lineChart().options(nvOptions);
		}

		function renderScatterPlot() {
			//set size of the bubbles depending on browser width
/*			var browserWidth = $(window).width(),
				browserCoef = Math.max( 1, browserWidth / 1100 ),
				pointMin = 100 * Math.pow( browserCoef, 2 ),
				pointMax = 1000 * Math.pow( browserCoef, 2 );
			var points = [pointMin, pointMax];

			if (!nvd3) nvd3 = nv.models.scatterChart();
			nvd3.options(nvOptions).pointRange(points).showDistX(true).showDistY(true);	*/

			/*

			if (!viz) {
				viz = owid.view.scatter();
			}*/

			/*viz.update({
				svg: svg,
				data: localData,
				bounds: { left: chartOffsetX, top: chartOffsetY+10, width: chartWidth-10, height: chartHeight-10 },
				axisConfig: {
					x: {
						domain: xDomain,
						scaleType: xAxisScale,
						label: xAxis['axis-label'],
						tickFormat: function(d) {
							return xAxisPrefix + owid.unitFormat({ format: xAxisFormat||5 }, d) + xAxisSuffix;							
						}
					},

					y: {
						domain: yDomain,
						scaleType: yAxisScale,
						label: yAxis['axis-label'],
						tickFormat: function(d) {
							return yAxisPrefix + owid.unitFormat({ format: yAxisFormat }, d) + yAxisSuffix;
						}
					}
				}
			});*/

/*			xDomain = d3.extent(allValues.map(function(d) { return d.x; }));
			yDomain = d3.extent(allValues.map(function(d) { return d.y; }));
			isClamped = _.isFinite(xAxisMin) || _.isFinite(xAxisMax) || _.isFinite(yAxisMin) || _.isFinite(yAxisMax);

			if (_.isFinite(xAxisMin) && (xAxisMin > 0 || xAxisScale != "log"))
				xDomain[0] = xAxisMin;
			if (_.isFinite(xAxisMax))
				xDomain[1] = xAxisMax;

			if (_.isFinite(yAxisMin) && (yAxisMin > 0 || yAxisScale != "log"))
				yDomain[0] = yAxisMin;
			if (_.isFinite(yAxisMax))
				yDomain[1] = yAxisMax;

		    // Hide dots that are off the scale
		    localData = _.filter(localData, function(d) {
		    	return !(d.values[0].x < xDomain[0] || d.values[0].x > xDomain[1] ||
		    		d.values[0].y < yDomain[0] || d.values[0].y > yDomain[1]);
		    });*/

			if (!viz) {
				viz = owid.viz.scatter();
			}

			viz.update({
				chart: chart,
				svg: svg,
				bounds: { left: chartOffsetX, top: chartOffsetY+10, width: chartWidth-10, height: chartHeight-10 },
				axisConfig: {
					x: {
						domain: xDomain,
						scaleType: xAxisScale,
						label: xAxis['axis-label'],
						tickFormat: function(d) {
							return xAxisPrefix + owid.unitFormat({ format: xAxisFormat||5 }, d) + xAxisSuffix;							
						}
					},

					y: {
						domain: yDomain,
						scaleType: yAxisScale,
						label: yAxis['axis-label'],
						tickFormat: function(d) {
							return yAxisPrefix + owid.unitFormat({ format: yAxisFormat }, d) + yAxisSuffix;
						}
					}
				},
				dimensions: chart.model.getDimensions(),
				variables: chart.vardata.get('variables'),
				inputYear: (chart.model.get('chart-time')||[])[0]
			});

			chart.dispatch.renderEnd();
			
			chartTab.viz = viz;			
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

			var hideToggle = chart.model.get("hide-toggle");

			nvOptions.showTotalInTooltip = true;

			nvd3 = nv.models.stackedAreaChart()
				.options(nvOptions)
				.controlOptions(hideToggle ? [] : ["Stacked", "Expanded"])
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

			chartOffsetY += 20;
		}

		function renderDiscreteBar() {
			nvOptions.showValues = true;

			nvd3 = nv.models.discreteBarChart()
				.x(function(d) { return d.x; })
				.y(function(d) { return d.y; })
				.options(nvOptions);

			chartOffsetX += 60;
			chartOffsetY += 20;
		}

		function renderTooltips() {
			if (!nvd3) return;

			if (chartType == App.ChartType.StackedArea)
				nvd3.interactiveLayer.tooltip.contentGenerator(owid.contentGenerator);
			else
				nvd3.tooltip.contentGenerator(owid.contentGenerator);
		}

		function renderAxis() {
			chartTab.scaleSelectors.render();
			if (!nvd3) return;

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
			xDomain = d3.extent(allValues.map(function(d) { return d.x; }));
			yDomain = d3.extent(allValues.map(function(d) { return d.y; }));
			isClamped = _.isFinite(xAxisMin) || _.isFinite(xAxisMax) || _.isFinite(yAxisMin) || _.isFinite(yAxisMax);

			if (_.isFinite(xAxisMin) && (xAxisMin > 0 || xAxisScale != "log"))
				xDomain[0] = xAxisMin;
			if (_.isFinite(xAxisMax))
				xDomain[1] = xAxisMax;

			if (_.isFinite(yAxisMin) && (yAxisMin > 0 || yAxisScale != "log")) {
				yDomain[0] = yAxisMin;
			} else {
				//default is zero (don't do it for stack bar chart or log scale, messes up things)
				if (chartType != App.ChartType.StackedArea && yAxisScale != "log")
					yDomain[0] = 0;
			}
			if (_.isFinite(yAxisMax))
				yDomain[1] = yAxisMax;

			if (isClamped) {
				if (nvd3 && chartType !== App.ChartType.MultiBar && chartType !== App.ChartType.HorizontalMultiBar && chartType !== App.ChartType.DiscreteBar && chart.model.get("currentStackMode") != "relative") {
					//version which makes sure min/max values are present, but will display values outside of the range
					nvd3.forceX(xDomain);
					nvd3.forceY(yDomain);
				}
			}

			// Only scatter plots have non-ordinal x axis
			if (chartType == App.ChartType.ScatterPlot) {
				if (xAxisScale === "linear") {
					nvd3.xScale(d3.scale.linear());
				} else if (xAxisScale === "log") {
					nvd3.xScale(d3.scale.log());

					// MISPY: Custom calculation of axis ticks, since nvd3 doesn't
					// account for log scale when doing its own calc and that can result in
					// overlapping axis labels.
					var minPower10 = Math.ceil(Math.log(xDomain[0]) / Math.log(10));
					var maxPower10 = Math.floor(Math.log(xDomain[1]) / Math.log(10));

					var tickValues = [];
					for (var i = minPower10; i <= maxPower10; i++) {
						tickValues.push(Math.pow(10, i));
					}
					nvd3.xAxis.tickValues(tickValues);
				}
			}

			if (yAxisScale === "linear") {
				nvd3.yScale(d3.scale.linear());
			} else if (yAxisScale === "log") {
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

			nvd3.xAxis
				.axisLabel(xAxis["axis-label"])
				.axisLabelDistance(xAxisLabelDistance)
				.tickFormat(function(d) {
					if (chartType == App.ChartType.ScatterPlot) {
						return xAxisPrefix + owid.unitFormat({ format: xAxisFormat }, d) + xAxisSuffix;
					} else if (chartType == App.ChartType.DiscreteBar) {
						return d;
					} else {
						return App.Utils.formatTimeLabel("Year", d, xAxisPrefix, xAxisSuffix, xAxisFormat);
					}
				});

			nvd3.yAxis
				.axisLabel(yAxis["axis-label"])
				.axisLabelDistance(yAxisLabelDistance)
				.tickFormat(function(d) { return yAxisPrefix + owid.unitFormat({ format: yAxisFormat }, d) + yAxisSuffix; })
				.showMaxMin(false);
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

		function ensureLabelsFit() {
			if (xAxis['axis-label']) {
				var xAxisLabel = d3.select('.nv-x .nv-axislabel, .bottom.axis .axis-label');

				xAxisLabel.attr('transform', '');
				var bounds = chart.getBounds(xAxisLabel.node()),
					box = xAxisLabel.node().getBBox(),
					diff = Math.max(tabBounds.left-bounds.left, bounds.right-tabBounds.right)*2;

				if (diff > 0) {
					var scale = (box.width-diff)/box.width,
						centerX = box.x + box.width/2, centerY = box.y + box.height/2,
						offsetX = -centerX*(scale-1), offsetY = -centerY*(scale-1);
					var transform = 'translate(' + offsetX + ',' + offsetY + ') scale(' + scale + ')';
					owid.transformElement(xAxisLabel.node(), transform);
					xAxisLabel.attr('transform', transform);	
				}				
			}

			if (yAxis['axis-label']) {
				var yAxisLabel = d3.select('.nv-y .nv-axislabel, .left.axis .axis-label');

				yAxisLabel.attr('transform', 'rotate(-90)');
				var bounds = chart.getBounds(yAxisLabel.node()),
					box = yAxisLabel.node().getBBox(),
					diff = Math.max((tabBounds.top+legend.height()+20)-bounds.top, bounds.bottom-tabBounds.bottom)*2;

				if (diff > 0) {
					var scale = (box.width-diff)/box.width,
						centerX = box.x + box.width/2, centerY = box.y + box.height/2,
						offsetX = -centerX*(scale-1), offsetY = -centerY*(scale-1);
					var transform = 'rotate(-90) translate(' + offsetX + ',' + offsetY + ') scale(' + scale + ')';
					owid.transformElement(yAxisLabel.node(), transform);
					yAxisLabel.attr('transform', transform);	
				}
			}
		}

		function postRender() {
			// Hijack the nvd3 mode switch to store it
			$(".nv-controlsWrap .nv-series").off('click').on('click', function(ev) {
				chart.model.set("currentStackMode", $(ev.target).closest('.nv-series').text().toLowerCase());
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

			chart.dispatch.renderEnd();
		}

		return chartTab;
	};
})();