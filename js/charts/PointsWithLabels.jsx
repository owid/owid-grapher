// @flow

/* ScatterPlot.jsx
 * ================                                                             
 *
 * Entry point for scatter charts
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */ 

import _ from 'lodash'
import * as d3 from 'd3'
import owid from '../owid'
import React, { createElement, Component, cloneElement } from 'react'
import {observable, computed, action, autorun} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import NoData from './NoData'
import AxisScale from './AxisScale'

export type ScatterSeries = {
    color: string,
    key: string,
    label: string,
    values: { x: number, y: number, size: number }
};

@observer
export default class PointsWithLabels extends Component {
    props: {
        data: ScatterSeries[],
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
        return d3.scaleLinear().range([3, 8])
            .domain([
                d3.min(data, function(series) { return d3.min(series.values, function(d) { return d.size||1; }); }),
                d3.max(data, function(series) { return d3.max(series.values, function(d) { return d.size||1; }); })
            ]);
    }

    @computed get hovered() {
        return "none"
    }

    // Used if no color is specified for a series
    @computed get defaultColorScale() {
        return d3.scaleOrdinal().range(d3.schemeCategory20)        
    }

    @computed get pointData() {
        const {data, xScale, yScale, defaultColorScale, sizeScale, hovered} = this


        return _.map(data, d => {
            return {
                color: d.color || defaultColorScale(d.key),
                values : _.map(d.values, v => {
                    return {
                        x: xScale.place(v.x),
                        y: yScale.place(v.y),                       
                        size: sizeScale(v.size||1) * (hovered == d ? 1.5 : 1),
                    }
                })
            }
        })
    }

    render() {
        const {bounds, pointData, xScale, yScale, sizeScale, hovered} = this

        if (_.isEmpty(pointData))
            return <NoData bounds={bounds}/>

        return <g>
            {_.map(pointData, d => 
                <g class="entity">
                    {_.map(d.values, (v, i) =>
                        [
                            <circle
                                cx={v.x} cy={v.y}
                                fill={d.color} stroke="#000" stroke-width={0.3}
                                r={v.size}
                                fill-opacity={0.7}
                            />,
                            (i < d.values.length - 1 && <line
                                x1={v.x} x2={d.values[i+1].x} y1={v.y} y2={d.values[i+1].y}
                                stroke={d.color}
                                stroke-opacity={0.7}
                            />)
                        ]
                    )}
                </g>
            )}
        </g>
    }
}
