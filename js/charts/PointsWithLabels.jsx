/* PointsWithLabels.jsx
 * ================                                                             
 *
 * Core scatterplot renderer
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */ 

// @flow

import React, {Component} from 'react'
import {observable, computed, action, autorun} from 'mobx'
import {observer} from 'mobx-react'
import _ from 'lodash'
import * as d3 from 'd3'
import owid from '../owid'
import Bounds from './Bounds'
import NoData from './NoData'
import AxisScale from './AxisScale'
import styles from './ScatterPlot.css'
import {getRelativeMouse} from './Util'
import Labels from './Labels'
import type {LabelDatum} from './Labels'
import type {SVGElement} from './Util'
import Vector2 from './Vector2'

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

    @observable persistentFocusKeys : Object = {}
    @observable hoverKey : ?string = null

    @computed get focusKeys() : string[] {
        const {persistentFocusKeys, hoverKey} = this       
        return _.keys(persistentFocusKeys).concat(hoverKey ? [hoverKey] : [])
    }

    @computed get data(): ScatterSeries[] {
        return this.props.data
    }

    @computed get bounds() : Bounds {
        return this.props.bounds
    }

    @computed get xScale() : AxisScale {
        return this.props.xScale.extend({ range: this.bounds.xRange() })
    }

    @computed get yScale() : AxisScale {
        return this.props.yScale.extend({ range: this.bounds.yRange() })
    }

    @computed get sizeScale() : Function {
        const {data} = this
        return d3.scaleLinear().range([1, 7])
            .domain(d3.extent(_.flatten(_.map(data, series => _.map(series.values, 'size')))))
    }

    @computed get fontScale() : Function {
        return d3.scaleLinear().range([9, 12]).domain(this.sizeScale.domain());
    }

    // Used if no color is specified for a series
    @computed get defaultColorScale() {
        return d3.scaleOrdinal().range(d3.schemeCategory20)
    }

    // Pre-transform data for rendering
    @computed get initialRenderData() : { position: Vector2, size: number, time: Object }[] {
        const {data, xScale, yScale, defaultColorScale, sizeScale, fontScale} = this

        return _.sortBy(_.map(data, d => {
            const fontSize = fontScale(_.last(d.values).size||1)
            const values = _.map(d.values, v => {
                return {
                    position: new Vector2(
                        Math.floor(xScale.place(v.x)),
                        Math.floor(yScale.place(v.y))
                    ),
                    size: sizeScale(v.size||1),
                    time: v.time
                }
            })

            const firstValue = _.first(values)
            const endVector = _.last(values).position.subtract(values[values.length-2].position)
 /*.concat(_.map(values, (v, i) => {
                return {
                    text: v.time.x,
                    fontSize: fontSize,
                    bounds: Bounds.forText(v.time.x, { x: v.x, y: v.y, fontSize: fontSize })
                }
            }))*/

            return {
                key: "key-" + owid.makeSafeForCSS(d.key),
                color: d.color || defaultColorScale(d.key),
                size: _.last(values).size,
                fontSize: fontSize,
                values: values,
                endVector: endVector,
                label: d.label
            }
        }), 'size')
    }

    labelPriority(d1: Object, d2: Object): Object {
        if (d1.isHovered)
            return d1
        else if (d2.isHovered)
            return d2
        else if (d1.isFocused)
            return d1
        else if (d2.isFocused)
            return d2
        else
            return d1
    }

    @computed get renderData(): { position: Vector2, size: number, time: Object }[] {
        const {initialRenderData, hoverKey, focusKeys, labelPriority} = this
        const renderData = _.sortBy(initialRenderData, d => -d.size)


        _.each(renderData, d => { 
            d.isHovered = d.key == hoverKey
            d.isFocused = _.includes(focusKeys, d.key)
        })

        _.each(renderData, d => {
            const lastValue = _.last(d.values)
            let labelPos = lastValue.position.clone()//lastValue.position.add(d.endVector.normalized.times(2))
            const fontSize = d.fontSize * (d.isFocused ? 2 : 1)
            let labelBounds = Bounds.forText(d.label, { fontSize: fontSize })

            labelPos.x -= labelBounds.width/2
            labelPos.y -= labelBounds.height/2 + labelBounds.height/4

            labelBounds = labelBounds.extend({...labelPos})

            const secondLastValue = d.values[d.values.length-2]

            const intersections = labelBounds.intersectLine(lastValue.position, secondLastValue.position)
            const ipos = _.sortBy(intersections, pos => Vector2.distanceSq(secondLastValue.position, pos))[0]

//            if (ipos)
//                labelPos = labelPos.add(lastValue.position.subtract(ipos))

            d.labels = [
                { 
                    text: d.label,
                    fontSize: fontSize,
                    bounds: labelBounds.extend({...labelPos}),
                    ipos: ipos
                }
            ]
        })

        // Eliminate overlapping labels,
        _.each(renderData, d => { d.isActive = true })
        _.each(renderData, (d1, i) => {
            _.each(renderData.slice(i+1), d2 => {
                const intersect = _.some(d1.labels, l1 => _.some(d2.labels, l2 => l1.bounds.intersects(l2.bounds)))
                if (d1 !== d2 && d1.isActive && d2.isActive && intersect) {
                    //if (d1.labels[0].text == "Tajikistan" || d2.labels[0].text == "Tajikistan")
                    //    console.log(d1, d2)
                    if (labelPriority(d1, d2) == d1)
                        d2.isActive = false
                    else
                        d1.isActive = false                    
                }     
            })
        })

        /*_.each(renderData, d => {
            if (!d.isActive) return

            _.each(d.labels, (l1, i) => {
                _.each(d.labels.slice(i+1), l2 => {
                    if (l1.bounds.intersects(l2.bounds))
                        l2.isHidden = true
                })
            })
        })*/

        return renderData
    }



    /*@computed get renderData() : Object[] {
        const {initialPointData, focusKey} = this

        return _.map(initialPointData, d => {
            return _.extend({}, d, {
                size: d.size * (focusKey == d ? 1.5 : 1)
            })
        })
    }*/

    @computed get allColors() : string[] {
        return _.uniq(_.map(this.renderData, 'color'))
    }

    @observable focusKey = null

    base: SVGElement

    @action.bound onMouseMove() {
        const mouse = Vector2.fromArray(d3.mouse(this.base))

        if (!this.bounds.contains(mouse))
            this.hoverKey = null
        else {
            const closestSeries = _.sortBy(this.renderData, (series) => {
                if (series.values.length == 1) {
                    return Vector2.distanceSq(series.values[0].position, mouse)
                } else {
                    return _.min(_.map(series.values.slice(0, -1), (d, i) => {
                        return Vector2.distanceFromPointToLineSq(mouse, d.position, series.values[i+1].position)
                    }))
                }
            })[0]
            this.hoverKey = closestSeries.key
        }       
    }

    @action.bound onClick() {
        const {hoverKey, persistentFocusKeys} = this
        if (hoverKey) {
            if (persistentFocusKeys[hoverKey])
                delete persistentFocusKeys[hoverKey]
            else
                persistentFocusKeys[hoverKey] = true
        }
    }

    componentDidMount() {
        d3.select("html").on("mousemove.scatter", this.onMouseMove)
        d3.select("html").on("click.scatter", this.onClick)
    }    

    componentDidUnmount() {
        d3.select("html").on("mousemove.scatter", null)
        d3.select("html").on("click.scatter", null)  
    }

    @computed get isFocusMode() : boolean {
        return !!(this.focusKeys.length || this.renderData.length == 1)
    }

    render() {
        Bounds.debug(_.flatten(_.map(this.renderData, d => _.map(d.labels, 'bounds'))))
        const {bounds, renderData, xScale, yScale, sizeScale, focusKeys, allColors, isFocusMode} = this
        window.p = this

        if (_.isEmpty(renderData))
            return <NoData bounds={bounds}/>


        const defaultOpacity = 1

        return <g class={styles.ScatterPlot}>
            <g class="entities" strokeOpacity={defaultOpacity} fillOpacity={defaultOpacity}>
                {_.map(renderData, d => {
                    const color = ((isFocusMode && !d.isFocused) || !d.isActive) ? "#e2e2e2" : d.color

                    return [
                        <defs>
                            <marker key={d.key} id={d.key} fill={color} viewBox="0 -5 10 10" refx={5} refY={0} markerWidth={4} markerHeight={4} orient="auto">
                                <path d="M0,-5L10,0L0,5"/>
                            </marker>
                           <marker id={d.key+'-start'} viewBox="0 0 12 12"
                                   refX={5} refY={5} orient="auto" fill={color}>
                             <circle cx={5} cy={5} r={5}/>
                           </marker>        
                        </defs>,
                        <polyline
                            class={d.key}
                            strokeLinecap="round"
                            stroke={color}
                            strokeOpacity={d.isFocused && 1}
                            points={_.map(d.values, v => `${v.position.x},${v.position.y}`).join(' ')}
                            fill="none"
                            strokeWidth={d.isHovered ? 3 : (d.isFocused ? 2 : 0.5)}
                            markerStart={`url(#${d.key}-start)`}
                            markerEnd={`url(#${d.key})`}
                        />
                    ]
                })}
            </g>
            <g class="labels">
                {_.map(renderData, d =>
                    _.map(d.labels, (l, i) => 
                        d.isActive && !l.isHidden && <text x={l.bounds.x} y={l.bounds.y+l.bounds.height} fontSize={l.fontSize} fontWeight={d.isHovered && "bold"} opacity={d.isFocused ? 1 : 0.8}>{l.text}</text>
                    )
                )}
                {_.map(renderData, d =>
                    _.map(d.labels, (l, i) => 
                        l.ipos && <circle cx={l.ipos.x} cy={l.ipos.y} r={2} fill="red"/>
                    )
                )}
            </g>
        </g>
    }
}
