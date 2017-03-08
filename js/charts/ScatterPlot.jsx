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

type ScatterDatum = {
    color: string,
    key: string,
    label: string,
    values: { x: number, y: number, size: number }
};

class LabelledPoints extends Component {
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

    @computed get yScale() : AxisScale {
        const {yDomain, bounds} = this
        const yRange = this.props.bounds.padBottom(50).yRange()
        return new AxisScale({ scaleType: 'linear', domain: yDomain, range: yRange, tickFormat: d => d.toString() })
    }


    render() {
        const {bounds, data} = this

        const yTickFormat = d => d
        const yScaleType = 'linear'
        const yScale = this.yScale

        if (_.isEmpty(data))
            return <NoData bounds={bounds}/>

        return <g>
            <Axis layout="left" orient="left" tickFormat={yTickFormat} scale={yScale} scaleType={yScaleType} bounds={bounds}/>

            {_.map(data, d => 
                <g class="entity">

                </g>
            )}
        </g>
    }
}

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
        return <LabelledPoints data={data} bounds={bounds}/>
    }
}