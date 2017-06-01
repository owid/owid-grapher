import React from 'react'
import {render} from 'preact'
import {computed} from 'mobx'
import {preInstantiate} from './Util'
import Header from './Header'
import SourcesFooter from './SourcesFooter'
import SlopeChart from './SlopeChart'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'
import _ from 'lodash'
import $ from 'jquery'
import owid from '../owid'
import dataflow from './owid.dataflow'
import scaleSelectors from './owid.view.scaleSelectors'
import Scatter from './owid.viz.scatter'
import EntitySelect from './owid.view.entitySelect'
import Legend from './App.Views.Chart.Legend'
import nv from 'nvd3'
import ScatterPlot from './ScatterPlot'

export default class ChartTab extends React.Component {
    componentDidMount() {
        this.props.chartView.svg = d3.select(d3.select(this.base).node().parentNode)
        this.props.chartView.el = d3.select("#chart")
        this.chartTab = chartTabOld(this.props.chartView)
        this.componentDidUpdate()
    }

    componentDidUpdate() {
		if (this.props.chart.type == App.ChartType.ScatterPlot || this.props.chart.type == App.ChartType.SlopeChart)
			this.props.onRenderEnd && this.props.onRenderEnd()
		else {
			this.chartTab.onRenderEnd = this.props.onRenderEnd
			this.chartTab.render(this.bounds)
		}
    }

    componentWillUnmount() {
        this.chartTab.clean()
    }

    @computed get header() {
        const {props} = this
        const {bounds, chart} = props

        let minYear = null
        let maxYear = null
        if (chart.type == App.ChartType.ScatterPlot) {
            minYear = chart.timeDomain[0];
            maxYear = chart.timeDomain[1];
        }

        return preInstantiate(<Header
            bounds={bounds}
            titleTemplate={chart.title}
            titleLink={this.props.chartView.url.getCurrentLink()}
            subtitleTemplate={chart.subtitle}
            logosSVG={chart.logosSVG}
            entities={chart.selectedEntities}
            entityType={chart.entityType}
            minYear={minYear}
            maxYear={maxYear}
        />)
    }

    @computed get footer() {
        const {props} = this
        const {chart} = props

        return preInstantiate(<SourcesFooter
            bounds={props.bounds}
            chartView={props.chartView}
            note={chart.note}
            originUrl={chart.originUrl}
         />)
    }

    renderChart() {
        if (this.props.chart.type == App.ChartType.SlopeChart)
            return <SlopeChart bounds={this.bounds.padTop(20)} config={this.props.chartView.chart}/>
        else if (this.props.chart.type == App.ChartType.ScatterPlot)
            return <ScatterPlot bounds={this.bounds.padTop(20).padBottom(10)} config={this.props.chartView.chart} isStatic={this.props.chartView.isExport}/>
        else
            return null
    }

    render() {
        const {header, footer} = this
        this.bounds = this.props.bounds.padTop(header.height).padBottom(footer.height)

        return <g class="chartTab">
            <Header {...header.props}/>
            {this.renderChart()}
            <SourcesFooter {...footer.props}/>
        </g>
    }
}

// Override nvd3 handling of zero data charts to prevent it removing
// all of our svg stuff
nv.utils.noData = function(nvd3, container) {
    container.selectAll('g.nv-wrap').remove();
    //chart.showMessage("No data available.");
};

const chartTabOld = function(chart) {
	var chartTab = dataflow();

	var $svg, $tab, //$entitiesSelect,
		$xAxisScale, $yAxisScale,
		svg, nvd3, viz;

	var chartType, localData, missingMsg, lineType;
	var bounds;

	var legend = new Legend();
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
		xAxisMin = owid.numeric(xAxis["axis-min"], null),
		xAxisMax = owid.numeric(xAxis["axis-max"], null),
		yAxisMin = owid.numeric(yAxis["axis-min"], null),
		yAxisMax = owid.numeric(yAxis["axis-max"], null),
		xAxisScale = xAxis["axis-scale"] || "linear",
		yAxisScale = yAxis["axis-scale"] || "linear",
		xAxisFormat = xAxis["axis-format"],
		yAxisFormat = yAxis["axis-format"] || 5;

	var xDomain, yDomain, isClamped;

	chartTab.scaleSelectors = scaleSelectors(chart, chartTab);

	var nvOptions = {
		showLegend: false
	};

	chart.model.on('change:chart-type', function() {
		chartTab.clean();
	});

	chartTab.clean = function() {
		if (viz) viz = viz.destroy();

		chartTab.scaleSelectors.clean();

		d3.selectAll(".nvd3, .axisBox, .nvtooltip:not(.owid-tooltip), .timeline").remove();
//			chartTab.scaleSelectors.hide();
		d3.selectAll("svg").on("mousemove.stackedarea", null);
		nvd3 = null;
	},

	chartTab.render = function(inputBounds) {
		bounds = inputBounds.pad(10);

		margins = _.clone(chart.model.get("margins"));
		chartOffsetX = bounds.left;
		chartOffsetY = bounds.top;
		chartHeight = bounds.height;
		chartWidth = bounds.width;

		configureTab();
		if (chart.model.get('chart-type') != App.ChartType.SlopeChart && chart.model.get('chart-type') != App.ChartType.ScatterPlot)
			configureData();
		else
			missingMsg = null
		configureAxis();
		renderLegend();

		$(".chart-error").remove();
		if (missingMsg || (_.isEmpty(localData) && chartType != App.ChartType.ScatterPlot && chartType != App.ChartType.SlopeChart)) {
			chart.el.selectAll(".nv-wrap").remove();
			//chart.showMessage(missingMsg || "No available data.");
			return;
		}

		updateAvailableCountries();

		// Initialize or update the nvd3 graph

		function updateGraph() {
			if (chartType == App.ChartType.LineChart && (lineType == App.LineType.DashedIfMissing))
				localData = splitSeriesByMissing(localData);

			if (chartType == App.ChartType.LineChart) {
				renderLineChart();
			} else if (chartType == App.ChartType.ScatterPlot) {
				return
			} else if (chartType == App.ChartType.StackedArea) {
				renderStackedArea();
			} else if (chartType == App.ChartType.MultiBar || chartType == App.ChartType.HorizontalMultiBar) {
				renderMultiBar();
			} else if (chartType == App.ChartType.DiscreteBar) {
				renderDiscreteBar();
			} else if (chartType == App.ChartType.SlopeChart) {
				return
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
				setTimeout(postRender, 500);
			}

			renderAxis();
			renderTooltips();

			if (nvd3) {
				nvd3.duration(0);
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
		}

		if (!nvd3 && chartType != App.ChartType.ScatterPlot)
			nv.addGraph(updateGraph);
		else {
			if (nvd3 && chartType == App.ChartType.ScatterPlot) {
				nvd3 = null;
				$('.nvd3').remove();
			}
			updateGraph();
		}
	};

	function configureTab() {
		chartType = chart.model.get('chart-type');
		svg = chart.svg;
		svg.attr("class", "nvd3-svg " + chartType);
//		$entitiesSelect = $(svg.node()).find('[name=available_entities]');
	}

	function configureData() {
		localData = chart.data.transformData();
		missingMsg = chart.model.checkMissingData();

		// Add classes to the series so we can style e.g. the World line differently
		_.each(localData, function(d) {
			d.classed = owid.makeSafeForCSS(d.key) + (d.isProjection ? " projection" : "");
		});

		lineType = chart.model.get('line-type');
	}

	function configureAxis() {
		xAxis = chart.model.get("x-axis");
		yAxis = chart.model.get("y-axis");
		xAxisPrefix = xAxis["axis-prefix"] || "";
		xAxisSuffix = xAxis["axis-suffix"] || "";
		yAxisPrefix = yAxis["axis-prefix"] || "";
		yAxisSuffix = yAxis["axis-suffix"] || "";
		xAxisLabelDistance = +xAxis["axis-label-distance"] || 0;
		yAxisLabelDistance = +yAxis["axis-label-distance"] || 0;
		xAxisMin = owid.numeric(xAxis["axis-min"], null),
		xAxisMax = owid.numeric(xAxis["axis-max"], null),
		yAxisMin = owid.numeric(yAxis["axis-min"], null),
		yAxisMax = owid.numeric(yAxis["axis-max"], null),
		xAxisScale = xAxis["axis-scale"] || "linear";
		yAxisScale = yAxis["axis-scale"] || "linear";
		xAxisFormat = xAxis["axis-format"];
		yAxisFormat = yAxis["axis-format"] || 5;
	}

	var margins, tabBounds, chartOffsetX, chartOffsetY,
		chartWidth, chartHeight;

	function updateAvailableCountries() {
		if (chartType == App.ChartType.ScatterPlot) return;

		var availableEntities = App.VariableData.get("availableEntities"),
			selectedEntitiesById = chart.model.getSelectedEntitiesById(),
			entityType = chart.model.get("entity-type");

		// Fill entity selector with all entities not currently selected
		/*$entitiesSelect.empty();
		$entitiesSelect.append("<option disabled selected>Select " + entityType + "</option>");
		_.each(availableEntities, function(entity) {
			if (!selectedEntitiesById[entity.id]) {
				$entitiesSelect.append("<option value='" + entity.id + "'>" + entity.name + "</option>");
			}
		});

		$entitiesSelect.trigger("chosen:updated");
		$entitiesSelect.off('change').on('change', onAvailableCountries);*/
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

		chart.el.classed('line-dots', lineType == App.LineType.WithDots || lineType == App.LineType.DashedIfMissing);

		nvd3 = nv.models.lineChart().options(nvOptions);
	}

	// TEMPORARY
	chartTab.requires('xDomain', 'xAxisScale', 'xAxis', 'xAxisPrefix', 'xAxisFormat', 'xAxisSuffix',
					  'yDomain', 'yAxisScale', 'yAxis', 'yAxisPrefix', 'yAxisFormat', 'yAxisSuffix');

	chartTab.flow('xAxisConfig : xDomain, xAxisScale, xAxis, xAxisPrefix, xAxisFormat, xAxisSuffix', function(xDomain, xAxisScale, xAxis, xAxisPrefix, xAxisFormat, xAxisSuffix) {
		return {
			domain: xDomain,
			scaleType: xAxisScale,
			label: xAxis['axis-label'],
			tickFormat: function(d) {
				return xAxisPrefix + owid.unitFormat({ format: xAxisFormat||5 }, d) + xAxisSuffix;
			}
		};
	});

	chartTab.flow('yAxisConfig : yDomain, yAxisScale, yAxis, yAxisPrefix, yAxisFormat, yAxisSuffix', function(yDomain, yAxisScale, yAxis, yAxisPrefix, yAxisFormat, yAxisSuffix) {
		return {
			domain: yDomain,
			scaleType: yAxisScale,
			label: yAxis['axis-label'],
			tickFormat: function(d) {
				return yAxisPrefix + owid.unitFormat({ format: yAxisFormat||5 }, d) + yAxisSuffix;
			}
		};
	});

	chartTab.flow('axisConfig : xAxisConfig, yAxisConfig', function(xAxisConfig, yAxisConfig) {
		return { x: xAxisConfig, y: yAxisConfig };
	});

	function renderScatterPlot() {
		if (!viz) {
			viz = Scatter();
		} else if (viz.scatter.timeline && (viz.scatter.timeline.isPlaying || viz.scatter.timeline.isDragging)) {
			return;
		}

        var xDomain = [], yDomain = [];

        if (_.isFinite(xAxisMin) && (xAxisMin > 0 || xAxisScale != "log"))
            xDomain[0] = xAxisMin;
        if (_.isFinite(xAxisMax))
            xDomain[1] = xAxisMax;

        if (_.isFinite(yAxisMin) && (yAxisMin > 0 || yAxisScale != "log"))
            yDomain[0] = yAxisMin;
        if (_.isFinite(yAxisMax))
            yDomain[1] = yAxisMax;

        chartTab.update({
        	xDomain: xDomain||"",
        	xAxisScale: xAxisScale||"",
        	xAxis: xAxis||"",
        	xAxisPrefix: xAxisPrefix||"",
        	xAxisFormat: xAxisFormat||"",
        	xAxisSuffix: xAxisSuffix||"",

        	yDomain: yDomain||"",
        	yAxisScale: yAxisScale||"",
        	yAxis: yAxis||"",
        	yAxisPrefix: yAxisPrefix||"",
        	yAxisFormat: yAxisFormat||"",
        	yAxisSuffix: yAxisSuffix||"",
        });

		chartTab.viz = viz;

		viz.update({
			containerNode: chart.svg.node(),
			bounds: { left: chartOffsetX, top: chartOffsetY+10, width: chartWidth-10, height: chartHeight-10 },
			dimensions: chart.model.getDimensions(),
			variables: chart.vardata.get('variables'),
            timelineConfig: chart.model.get('timeline'),
            axisConfig: chartTab.axisConfig
		}, function() {
			postRender();
		});
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

		yDomain[1] += (yDomain[1]-yDomain[0])/100;

		if (isClamped) {
			if (nvd3 && chartType !== App.ChartType.MultiBar && chartType !== App.ChartType.HorizontalMultiBar && chartType !== App.ChartType.DiscreteBar && chart.model.get("currentStackMode") != "relative") {
				//version which makes sure min/max values are present, but will display values outside of the range
				nvd3.forceX(xDomain);
				nvd3.forceY(yDomain);
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
					return owid.formatTimeLabel("Year", d, xAxisPrefix, xAxisSuffix, xAxisFormat);
				}
			});

		nvd3.yAxis
			.axisLabel(yAxis["axis-label"])
			.axisLabelDistance(yAxisLabelDistance)
			.tickFormat(function(d) { return yAxisPrefix + owid.unitFormat({ format: yAxisFormat }, d) + yAxisSuffix; })
			.showMaxMin(false);
	}

	var entitySelect;
	function updateEntitySelect() {
		if (!entitySelect) return;

		entitySelect.update({
			containerNode: chart.htmlNode,
			entities: chart.model.getUnselectedEntities()
		});
	}

	function renderLegend() {
		if (chart.model.get('chart-type') != App.ChartType.SlopeChart && !chart.model.get("hide-legend")) {
			legend.dispatch.on("addEntity", function() {
				if (entitySelect)
					entitySelect = entitySelect.destroy();
				else {
					entitySelect = EntitySelect();

					entitySelect.afterClean(function() { entitySelect = null; });
				}
				updateEntitySelect();
			});
			updateEntitySelect();

			legend.render({
				containerNode: svg.node(),
				bounds: bounds
			});

			chartOffsetY += legend.height() + 10;
			chartHeight -= legend.height() + 10;
		} else {
			chart.svg.selectAll(".nvd3.nv-custom-legend").remove();
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
						currentSeries.p = 'dashed';
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
		if (chart.model.get('chart-type') == App.ChartType.SlopeChart || (viz && !d3.select('.axisBox').node())) return

		var targetHeight = viz ? d3.select('.axisBox').node().getBBox().height : chartHeight,
			targetWidth = chartWidth;

		if (xAxis['axis-label']) {
			var xAxisLabel = d3.select('.nv-x .nv-axislabel, .bottom.axis .axis-label');
			if (!xAxisLabel.node()) return

			xAxisLabel.attr('transform', '');
			var box = xAxisLabel.node().getBBox(),
				diff = box.width-(targetWidth-10);

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

			var box = yAxisLabel.node().getBBox(),
				diff = box.width-(targetHeight-30);

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
		ensureLabelsFit();
		chartTab.scaleSelectors.render(bounds);

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

        if (chartTab.onRenderEnd)
            chartTab.onRenderEnd()
	}

	return chartTab;
};

