// @flow

import _ from 'lodash'
import * as d3 from 'd3'
import owid from '../owid'
import React, { createElement, Component, cloneElement } from 'react'
import {observable, computed, action, autorun} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'
import NoData from './NoData'
import Axis from './Axis'
import AxisScale from './AxisScale'
import Layout from './Layout'

type ScatterDatum = {
    color: string,
    key: string,
    label: string,
    values: { x: number, y: number, size: number }
};

@observer
class LabelledPoints extends Component {
    props: {
        data: ScatterDatum[],
        bounds: Bounds,
        xScale: AxisScale,
        yScale: AxisScale
    }

    @computed get data() {
        return this.props.data
    }

    @computed get bounds() {
        return this.props.bounds
    }

    @computed get xScale() {
        return this.props.xScale.extend({ range: this.bounds.xRange() })
    }

    @computed get yScale() {
        return this.props.yScale.extend({ range: this.bounds.yRange() })
    }

    @computed get sizeScale() : Function {
        const {data} = this
        return d3.scaleLinear().range([6, 18])
            .domain([
                d3.min(data, function(series) { return d3.min(series.values, function(d) { return d.size||1; }); }),
                d3.max(data, function(series) { return d3.max(series.values, function(d) { return d.size||1; }); })
            ]);
    }

    @computed get hovered() {
        return "none"
    }

    render() {
        const {bounds, data, xScale, yScale, sizeScale, hovered} = this

        if (_.isEmpty(data))
            return <NoData bounds={bounds}/>

        const defaultColorScale = d3.scaleOrdinal().range(d3.schemeCategory20)

        return <g>
            {_.map(data, d => 
                <g class="entity">
                    <circle 
                        cx={xScale.place(d.values[0].x)} cy={yScale.place(d.values[0].y)}
                        fill={d.color || defaultColorScale(d.key)} stroke="#000" stroke-width={0.3}
                        r={sizeScale(d.values[0].size||1) * (hovered == d ? 1.5 : 1)}
                        fill-opacity={0.7}
                    />
                </g>
            )}
        </g>
    }
}

@observer
class ScatterWithAxis extends Component {
    props: {
        bounds: Bounds,
        data: ScatterDatum[]
    }

    @computed get bounds() : Bounds {
        return this.props.bounds
    }

    @computed get data() : ScatterDatum[] {
        return this.props.data
    }

    @computed get xDomain() : [number, number] {
        return d3.extent(_.map(_.flatten(_.map(this.data, 'values')), 'x'))
    }

    @computed get yDomain() : [number, number] {
        return d3.extent(_.map(_.flatten(_.map(this.data, 'values')), 'y'))
    }

    @computed get xScale() : AxisScale {
        const {xDomain, bounds} = this
        const xRange = this.props.bounds.xRange()
        return new AxisScale({ scaleType: 'linear', domain: xDomain, range: xRange, tickFormat: d => d.toString() })
    }    

    @computed get yScale() : AxisScale {
        const {yDomain, bounds} = this
        const yRange = this.props.bounds.yRange()
        return new AxisScale({ scaleType: 'linear', domain: yDomain, range: yRange, tickFormat: d => d.toString() })
    }

    render() {
        const {bounds, xScale, yScale, data} = this

        const xAxisBounds = Axis.calculateBounds(bounds, { orient: 'bottom', scale: xScale })
        const yAxisBounds = Axis.calculateBounds(bounds, { orient: 'left', scale: yScale })
        const innerBounds = bounds.padBottom(xAxisBounds.height).padLeft(yAxisBounds.width)

        return <g>
            <Axis orient="left" scale={yScale} bounds={bounds.padBottom(xAxisBounds.height)}/>
            <Axis orient="bottom" scale={xScale} bounds={bounds.padLeft(yAxisBounds.width)}/>
            <LabelledPoints xScale={xScale} yScale={yScale} data={data} bounds={innerBounds}/>
        </g>
    }
}

@observer
export default class ScatterPlot extends Component {
    props: {
        bounds: Bounds,
        config : ChartConfig
    };

    @computed get bounds() {
        return this.props.bounds
    }

    @computed get colorScheme() : string[] {
        return [ // TODO less ad hoc color scheme (probably would have to annotate the datasets)
            "#5675c1", // Africa
            "#aec7e8", // Antarctica
            "#d14e5b", // Asia
            "#ffd336", // Europe
            "#4d824b", // North America
            "#a652ba", // Oceania
            "#69c487", // South America
            "#ff7f0e", "#1f77b4", "#ffbb78", "#2ca02c", "#98df8a", "#d62728", "#ff9896", "#9467bd", "#c5b0d5", "#8c564b", "c49c94", "e377c2", "f7b6d2", "7f7f7f", "c7c7c7", "bcbd22", "dbdb8d", "17becf", "9edae5", "1f77b4"]
    }

    @computed get dimensions() : Object[] {
        return this.props.config.dimensions
    }

    @computed get colorScale() {
        const {colorScheme, dimensions} = this

        const colorScale = d3.scaleOrdinal().range(this.colorScheme)

        var colorDim = _.find(dimensions, { property: 'color' });
        if (colorDim) {
            colorScale.domain(colorDim.variable.categoricalValues);            
        }

        return colorScale
    }

    @computed get data() {
        const {dimensions, colorScale} = this

        var dataByEntity = {};

        _.each(dimensions, function(dimension) {
            var variable = dimension.variable,
                targetYear = _.isFinite(dimension.targetYear) ? dimension.targetYear : _.last(variable.years),
                tolerance = _.isFinite(dimension.tolerance) ? dimension.tolerance : 0;

            if (dimension.property == 'color' || dimension.property == 'size')
                tolerance = Infinity;

            for (var i = 0; i < variable.years.length; i++) {
                var year = variable.years[i],
                    value = variable.values[i],
                    entityId = variable.entities[i],
                    entity = variable.entityKey[entityId];

                // Skip years that aren't within tolerance of the target
                if (year < targetYear-tolerance || year > targetYear+tolerance)
                    continue;

                var series = owid.default(dataByEntity, entityId, {
                    id: entityId,
                    label: entity.name,
                    key: entity.name,
                    values: [{ time: {} }]
                });

                // Ensure we use the closest year to the target
                var currentYear = series.values[0].time[dimension.property];
                if (_.isFinite(currentYear) && Math.abs(targetYear-currentYear) < Math.abs(year-currentYear))
                    continue;

                var d = series.values[0];
                d.time[dimension.property] = year;

                if (dimension.property == 'color')
                    series.color = colorScale(value);
                else
                    d[dimension.property] = value;
            }
        });

        var data = [];

        // Exclude any with data for only one axis
        _.each(dataByEntity, function(series) {
            var datum = series.values[0];
            if (_.has(datum, 'x') && _.has(datum, 'y'))
                data.push(series);
        });

        return data;
    }

    @computed get minYear() : number {
        return _.min(_.map(this.data, function(d) { return _.min([d.values[0].time.x, d.values[0].time.y]); }))        
    }

    @computed get maxYear() : number {
        return _.max(_.map(this.data, function(d) { return _.max([d.values[0].time.x, d.values[0].time.y]); }))
    }

    componentWillMount() {
        // hack to get data to header
        autorun(() => {
            window.chart.model.set('chart-time', [this.minYear, this.maxYear]);
        })        
    }

    render() {
        const {data, bounds} = this
        return <ScatterWithAxis data={data} bounds={bounds}/>
    }
}