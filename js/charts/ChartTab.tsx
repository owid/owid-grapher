import * as React from 'react'
import {render} from 'preact'
import {computed} from 'mobx'
import {preInstantiate} from './Util'
import Header from './Header'
import SourcesFooter from './SourcesFooter'
import SlopeChart from './SlopeChart'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'
import * as _ from 'lodash'
import * as $ from 'jquery'
import owid from '../owid'
import dataflow from './owid.dataflow'
import scaleSelectors from './owid.view.scaleSelectors'
import EntitySelect from './owid.view.entitySelect'
import Legend from './App.Views.Chart.Legend'
import * as nv from '../libs/nvd3'
import ScatterPlot from './ScatterPlot'
import ChartView from './ChartView'
import AxisConfig from './AxisConfig'
import {defaultTo} from 'lodash'
import * as d3 from '../libs/d3old'
import {ChartTypes} from './ChartType'

export default class ChartTab extends React.Component<{ chartView: ChartView, chart: ChartConfig }, undefined> {
    componentDidMount() {
        this.props.chartView.svg = d3.select(d3.select(this.base).node().parentNode)
        this.props.chartView.el = d3.select("#chart")
        this.chartTab = chartTabOld(this.props.chartView)
        this.componentDidUpdate()
    }

    componentDidUpdate() {
		if (this.props.chart.type == ChartTypes.ScatterPlot || this.props.chart.type == ChartTypes.SlopeChart)
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
        if (chart.type == ChartTypes.ScatterPlot) {
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
        if (this.props.chart.type == ChartTypes.SlopeChart)
            return <SlopeChart bounds={this.bounds.padTop(20)} config={this.props.chartView.chart}/>
        else if (this.props.chart.type == ChartTypes.ScatterPlot)
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
nv.utils.noData = function(nvd3: any, container: any) {
    container.selectAll('g.nv-wrap').remove();
    //chart.showMessage("No data available.");
};

const chartTabOld = function(chartView: ChartView) {
	var chartTab = dataflow();
	const chart = chartView.chart

	var localData, missingMsg, lineType;
	var bounds: Bounds;

	var legend = new Legend();
	chartTab.legend = legend;

	var timeline;

	let xAxis: AxisConfig = chartView.config.xAxis
	let yAxis: AxisConfig = chartView.config.yAxis

	let margins: any
	let svg: any
	let nvd3: any
	let chartOffsetX: number = 0
	let chartOffsetY: number = 0
	let chartWidth: number = 0
	let chartHeight: number = 0
	let yDomain: [number, number] = [0,0]
	let xDomain: [number, number] = [0,0]

	chartTab.scaleSelectors = scaleSelectors(chartView, chartTab);

	var nvOptions = {
		showLegend: false
	};

	chartView.model.on('change:chart-type', function() {
		chartTab.clean();
	});

	chartTab.clean = function() {
		chartTab.scaleSelectors.clean();

		d3.selectAll(".nvd3, .axisBox, .nvtooltip:not(.owid-tooltip), .timeline").remove();
//			chartTab.scaleSelectors.hide();
		d3.selectAll("svg").on("mousemove.stackedarea", null);
		nvd3 = null;
	},

	chartTab.render = function(inputBounds) {
		bounds = inputBounds.pad(10);

		margins = _.clone(chartView.model.get("margins"));
		chartOffsetX = bounds.left;
		chartOffsetY = bounds.top;
		chartHeight = bounds.height;
		chartWidth = bounds.width;

		configureTab();
		configureData();
		renderLegend();

		$(".chart-error").remove();
		if (missingMsg || _.isEmpty(localData)) {
			chartView.el.selectAll(".nv-wrap").remove();
			//chartView.showMessage(missingMsg || "No available data.");
			return;
		}

		updateAvailableCountries();

		// Initialize or update the nvd3 graph

		function updateGraph() {
			if (chart.type == ChartTypes.LineChart && (lineType == App.LineType.DashedIfMissing))
				localData = splitSeriesByMissing(localData);

			if (chart.type == ChartTypes.LineChart) {
				renderLineChart();
			} else if (chart.type == ChartTypes.StackedArea) {
				renderStackedArea();
			} else if (chart.type == ChartTypes.MultiBar || chart.type == ChartTypes.HorizontalMultiBar) {
				renderMultiBar();
			} else if (chart.type == ChartTypes.DiscreteBar) {
				renderDiscreteBar();
			}

			if (nvd3) {
				nvd3.width(chartWidth);
				nvd3.height(chartHeight);
				var marginBottom = +margins.bottom + 20;
				if (chart.type == ChartTypes.MultiBar || chart.type == ChartTypes.DiscreteBar)
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

		if (!nvd3)
			nv.addGraph(updateGraph);
		else
			updateGraph();
	};

	function configureTab() {
		chart.type = chartView.model.get('chart-type');
		svg = chartView.svg;
		svg.attr("class", "nvd3-svg " + chart.type);
	}

	function configureData() {
		localData = chartView.data.transformData();
		missingMsg = chartView.model.checkMissingData();

		// Add classes to the series so we can style e.g. the World line differently
		_.each(localData, function(d) {
			d.classed = owid.makeSafeForCSS(d.key) + (d.isProjection ? " projection" : "");
		});

		lineType = chartView.model.get('line-type');
	}

	function updateAvailableCountries() {
		var availableEntities = App.VariableData.get("availableEntities"),
			selectedEntitiesById = chartView.model.getSelectedEntitiesById(),
			entityType = chartView.model.get("entity-type");
	}

	function onAvailableCountries(evt) {
		var $select = $(evt.currentTarget),
			val = $select.val(),
			$option = $select.find("[value=" + val + "]"),
			text = $option.text();

		if (chartView.model.get("add-country-mode") === "add-country") {
			chartView.model.addSelectedCountry({ id: $select.val(), name: text });
		} else {
			chartView.model.replaceSelectedCountry({ id: $select.val(), name: text });
		}
	}

	function renderLineChart() {
		var lineType = chartView.model.get("line-type");

		chartView.el.classed('line-dots', lineType == App.LineType.WithDots || lineType == App.LineType.DashedIfMissing);

		nvd3 = nv.models.lineChart().options(nvOptions);
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

		var hideToggle = chartView.model.get("hide-toggle");

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

		if (chartView.model.get("currentStackMode") == "relative")
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

		if (chart.type == ChartTypes.MultiBar) {
			nvd3 = nv.models.multiBarChart().options(nvOptions);
		} else if (chart.type == ChartTypes.HorizontalMultiBar) {
			nvd3 = nv.models.multiBarHorizontalChart().options(nvOptions);
		}

		if (chartView.model.get("currentStackMode") == "stacked")
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

		if (chart.type == ChartTypes.StackedArea)
			nvd3.interactiveLayer.tooltip.contentGenerator(owid.contentGenerator);
		else
			nvd3.tooltip.contentGenerator(owid.contentGenerator);
	}

	function renderAxis() {
		if (!nvd3) return;

		//get extend
		var allValues = [];
		_.each(localData, function(v, i) {
			if (v.values) {
				allValues = allValues.concat(v.values);
			} else if (_.isArray(v)) {
				//special case for discrete bar chart
				allValues = v;
			}
		});

		//domain setup
		const xDomainDefault = d3.extent(allValues.map(function(d) { return d.x; }))
		const yDomainDefault = d3.extent(allValues.map(function(d) { return d.y; }))
		const isClamped = _.isFinite(xAxis.min) || _.isFinite(xAxis.max) || _.isFinite(yAxis.min) || _.isFinite(yAxis.max)

		xDomain = [
			_.defaultTo(xAxis.min, xDomainDefault[0]),
			_.defaultTo(xAxis.max, xDomainDefault[1])
		]

		yDomain = [
			_.defaultTo(yAxis.min, yDomainDefault[0]),
			_.defaultTo(yAxis.max, yDomainDefault[1])
		]

		yDomain[1] += (yDomain[1]-yDomain[0])/100;

		if (isClamped) {
			if (nvd3 && chart.type !== ChartTypes.MultiBar && chart.type !== ChartTypes.HorizontalMultiBar && chart.type !== ChartTypes.DiscreteBar && chartView.model.get("currentStackMode") != "relative") {
				//version which makes sure min/max values are present, but will display values outside of the range
				nvd3.forceX(xDomain);
				nvd3.forceY(yDomain);
			}
		}

		if (yAxis.scaleType == 'linear')
			nvd3.yScale(d3.scale.linear())
		else
			nvd3.yScale(d3.scale.log())

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

		nvd3.xAxis
			.axisLabel(xAxis.label)
			.axisLabelDistance(defaultTo(xAxis.props.labelDistance, 0))
			.tickFormat(function(d) {
				if (chart.type == ChartTypes.DiscreteBar) {
					return d;
				} else {
					return owid.formatTimeLabel("Year", d, xAxis.prefix, xAxis.suffix, xAxis.numDecimalPlaces);
				}
			});

		nvd3.yAxis
			.axisLabel(yAxis.label)
			.axisLabelDistance(defaultTo(yAxis.props.labelDistance, 0))
			.tickFormat(yAxis.tickFormat)
			.showMaxMin(false);
	}

	var entitySelect;
	function updateEntitySelect() {
		if (!entitySelect) return;

		entitySelect.update({
			containerNode: chartView.htmlNode,
			entities: chartView.model.getUnselectedEntities()
		});
	}

	function renderLegend() {
		if (chartView.model.get("hide-legend")) {
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
			chartView.svg.selectAll(".nvd3.nv-custom-legend").remove();
		}
	}

	function splitSeriesByMissing(localData) {
		var lineType = chartView.model.get("line-type"),
			lineTolerance = parseInt(chartView.model.get("line-tolerance")) || 1,
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
		var targetHeight = chartHeight,
			targetWidth = chartWidth;

		if (xAxis.label) {
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

		if (yAxis.label) {
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
			chartView.model.set("currentStackMode", $(ev.target).closest('.nv-series').text().toLowerCase());
		});

		if (chart.type == ChartTypes.StackedArea) {
			// Stop the tooltip from overlapping the chart controls
			d3.selectAll("svg").on("mousemove.stackedarea", function() {
				var $target = $(d3.event.target);
				if (!$target.is("rect, path") || $target.closest(".nv-custom-legend").length)
					nvd3.interactiveLayer.tooltip.hidden(true);
			});

			// Override default stacked area click behavior
			d3.selectAll(".nv-area").on("click", function(d) {
				chartView.model.focusToggleLegendKey(d.key);
			});
		}

        if (chartTab.onRenderEnd)
            chartTab.onRenderEnd()
	}

	return chartTab;
};

