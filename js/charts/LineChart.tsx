/* LineChart.tsx
 * ================
 *
 * A standard line chart. Wrapping old nvd3 code, in progress to replace nvd3 entirely.
 *
 */

import * as React from 'react'
import * as _ from 'lodash'
import * as nv from '../libs/nvd3'
import * as d3 from '../libs/d3old'
import * as $ from 'jquery'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import LineType from './LineType'
import {defaultTo} from './Util'

interface LineChartValue {
    x: number,
    y: number,
    time: number,
    gapYearsToNext: number
}

interface LineChartSeries {
    key: string,
    color: string,
    label: string
    values: LineChartValue[],
    classed?: string 
}

@observer
export default class LineChart extends React.Component<{ bounds: Bounds, chart: ChartConfig, localData: LineChartSeries[] }, undefined> {
	splitSeriesByMissing(localData: LineChartSeries[]) {
        const {chart} = this.props
        const {lineTolerance} = chart
		
        let newData: LineChartSeries[] = [];

		_.each(localData, function(series) {
			let currentSeries: LineChartSeries|null = null;
			let currentMissing: boolean|null = null;

			_.each(series.values, function(d) {
				var isMissing = !!(d.gapYearsToNext && d.gapYearsToNext > lineTolerance);
				if (isMissing !== currentMissing) {
					if (currentSeries !== null) {
						// There's a single overlapping value to keep the lines joined
						currentSeries.values.push(d);
						newData.push(currentSeries);
					}
					currentSeries = _.extend({}, series, { values: [] });
					if (isMissing)
						currentSeries.classed = 'dashed';
					currentMissing = isMissing;
				}

				if (currentSeries !== null)
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

    @computed get localData(): LineChartSeries[] {
        const {chart, localData} = this.props
        if (chart.lineType == LineType.DashedIfMissing)
            return this.splitSeriesByMissing(localData);
        else
            return localData
    }

    @computed get allValues(): LineChartValue[] {
        return _.flatten(_.map(this.localData, series => series.values))
    }

    @computed get xDomainDefault(): [number, number] {
        return (d3.extent(this.allValues.map(function(d) { return d.x; })) as [number, number])
    }

    @computed get yDomainDefault(): [number, number] {
        return (d3.extent(this.allValues.map(function(d) { return d.y; })) as [number, number])
    }

    get svg() {
        return d3.select("svg")
    }

    @action.bound renderNVD3() {
        const {chart, bounds} = this.props
        const {svg, localData, xDomainDefault, yDomainDefault} = this
        const {xAxis, yAxis} = chart

        //chartView.el.classed('line-dots', chart.lineType == LineType.WithDots || chart.lineType == LineType.DashedIfMissing);
        const nvd3 = nv.models.lineChart().options({ showLegend: false });

        nvd3.width(bounds.width);
        nvd3.height(bounds.height);
        nvd3.margin({ left: 70, top: 10, right: 30, bottom: 30 });        
        /*nv.dispatch.on("render_end", function() {
            setTimeout(postRender, 500);
        });
        setTimeout(postRender, 500);*/

		//get extend


		//domain setup
		const isClamped = _.isFinite(xAxis.min) || _.isFinite(xAxis.max) || _.isFinite(yAxis.min) || _.isFinite(yAxis.max)

		const xDomain = [
			_.defaultTo(xAxis.min, xDomainDefault[0]),
			_.defaultTo(xAxis.max, xDomainDefault[1])
		]

		const yDomain = [
			_.defaultTo(yAxis.min, yDomainDefault[0]),
			_.defaultTo(yAxis.max, yDomainDefault[1])
		]

		//yDomain[1] += (yDomain[1]-yDomain[0])/100;

		if (isClamped) {
            nvd3.forceX(xDomain);
            nvd3.forceY(yDomain);
		}

		if (yAxis.scaleType == 'linear')
			nvd3.yScale(d3.scale.linear())
		else {
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
		}

		nvd3.xAxis
			.axisLabel(xAxis.label)
			.axisLabelDistance(defaultTo(xAxis.props.labelDistance, 0))
			.tickFormat((d) => owid.formatTimeLabel("Year", d, xAxis.prefix, xAxis.suffix, xAxis.numDecimalPlaces))

		nvd3.yAxis
			.axisLabel(yAxis.label)
			.axisLabelDistance(defaultTo(yAxis.props.labelDistance, 0))
			.tickFormat(yAxis.tickFormat)
			.showMaxMin(false);

        nvd3.tooltip.contentGenerator(owid.contentGenerator);

        nvd3.duration(0);
        svg.datum(localData).call(nvd3);

        var nvWrap = d3.select('.nvd3.nv-wrap > g');
        nvWrap.attr('transform', 'translate(' + bounds.left + ',' + bounds.top + ')');

        //if y axis has zero, display solid line
        var $pathDomain = $(".nvd3 .nv-axis.nv-x path.domain");
        if (yDomain[0] === 0) {
            $pathDomain.css("stroke-opacity", "1");
        } else {
            $pathDomain.css("stroke-opacity", "0");
        }
    }

    componentDidMount() {
        this.componentDidUpdate() 
    }

    componentDidUpdate() {
        this.renderNVD3();                
    }

    render() {
        return null
    }
}