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
import styles from './ScatterPlot.css'
import {getRelativeMouse} from './Util'

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

    // Used if no color is specified for a series
    @computed get defaultColorScale() {
        return d3.scaleOrdinal().range(d3.schemeCategory20)        
    }

    @computed get pointData() {
        const {data, xScale, yScale, defaultColorScale, sizeScale, focusKey} = this

        return _.map(data, d => {
            const values = _.map(d.values, v => {
                return {
                    x: Math.floor(xScale.place(v.x)),
                    y: Math.floor(yScale.place(v.y)),                       
                    size: sizeScale(v.size||1) * (focusKey == d ? 1.5 : 1),
                }
            })

            return {
                key: d.key,
                color: d.color || defaultColorScale(d.key),
                values: values
            }
        })
    }

    @computed get allColors() : string[] {
        return _.uniq(_.map(this.pointData, 'color'))
    }

    @observable focusKey = null

    @action.bound onMouseMove() {
        const mouse = d3.mouse(this.base)

        if (!this.bounds.containsPoint(...mouse))
            this.focusKey = null
        else {
            const closestSeries = _.sortBy(this.pointData, (series) => {
                if (series.values.length == 1) {
                    return Math.pow(series.values[0].x-mouse[0], 2)+Math.pow(series.values[0].y-mouse[1], 2)
                } else {
                    return _.min(_.map(series.values, (v, i) => {
                        return Math.pow(v.x-mouse[0], 2)+Math.pow(v.y-mouse[1], 2)
                    }))
                }
            })[0]
            this.focusKey = closestSeries.key
        }       
    }

    componentDidMount() {
        d3.select("html").on("mousemove", this.onMouseMove)
    }    

    render() {
        const {bounds, pointData, xScale, yScale, sizeScale, focusKey, allColors} = this

        if (_.isEmpty(pointData))
            return <NoData bounds={bounds}/>

        return <g class={styles.ScatterPlot}>
            <g class="entities" fillOpacity={0.6}>
                <defs>
                    {_.map(allColors, color =>
                        <marker key={color} id={"arrow"+color.slice(1)} fill={color} viewBox="0 -5 10 10" refx={5} refY={0} markerWidth={4} markerHeight={4} orient="auto">
                            <path d="M0,-5L10,0L0,5"/>
                        </marker>
                    )}
                </defs>
                {_.map(pointData, d => 
                    <polyline 
                        stroke={d.color}
                        points={_.map(d.values, v => `${v.x},${v.y}`).join(' ')} 
                        fill="none" 
                        strokeOpacity={focusKey == d.key ? 1 : 0.1}
                        marker-mid={false && `url(#arrow${d.color.slice(1)})`}/> 
                )}
            </g>
        </g>
    }
}
