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
        focusKeys: string[],
        bounds: Bounds,
        xScale: AxisScale,
        yScale: AxisScale
    }

    @observable hoverKey : ?string = null

    @computed get focusKeys() {
        return this.props.focusKeys || []
    }

    @computed get tmpFocusKeys() : string[] {
        const {focusKeys, hoverKey} = this
        return focusKeys.concat(hoverKey ? [hoverKey] : [])
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
        window.Vector2 = Vector2
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

            return {
                key: d.key,
                displayKey: "key-" + owid.makeSafeForCSS(d.key),
                color: d.color || defaultColorScale(d.key),
                size: _.last(values).size,
                fontSize: fontSize,
                values: values,
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
        const {initialRenderData, hoverKey, tmpFocusKeys, labelPriority} = this
        const renderData = _.sortBy(initialRenderData, d => -d.size)

        _.each(renderData, d => {
            d.isHovered = d.key == hoverKey
            d.isFocused = _.includes(tmpFocusKeys, d.key)
        })

        _.each(renderData, d => {
            const lastValue = _.last(d.values)
            let labelPos = lastValue.position.clone()
            const fontSize = d.fontSize * (d.isFocused ? 2 : 1)
            let labelBounds = Bounds.forText(d.label, { fontSize: fontSize })

            labelPos.x -= labelBounds.width/2
            labelPos.y -= labelBounds.height/2 + labelBounds.height/4

            labelBounds = labelBounds.extend({...labelPos})

            if (d.values.length > 1) {
                const secondLastValue = d.values[d.values.length-2]
                const intersections = labelBounds.intersectLine(lastValue.position, secondLastValue.position)
                const ipos = _.sortBy(intersections, pos => Vector2.distanceSq(secondLastValue.position, pos))[0]

                if (ipos)
                    labelPos = labelPos.add(lastValue.position.subtract(ipos).times(1.1))
            }

            d.labels = [
                {
                    text: d.label,
                    fontSize: fontSize,
                    bounds: labelBounds.extend({...labelPos})
                }
            ]

            // Individual year labels
            if (d.isFocused)
                d.labels = d.labels.concat(_.map(d.values.slice(0, -1), (v, i) => {
                    const prevSegment = i > 0 && v.position.subtract(d.values[i-1].position)
                    const nextSegment = d.values[i+1].position.subtract(v.position)


                    const potentialLabelSpots = []
                    let pos = v.position
                    let normals = []
                    if (prevSegment) {
                        normals = prevSegment.add(nextSegment).normalize().normals().map(x => x.times(30))
                        normals = [_.sortBy(normals, n => {
                            const distFromPrevPoint
                        }

                       // pos = pos.add(normal.normalize().times(10))
                    }

                    return {
                        text: v.time.x.toString(),
                        normals: normals,
                        fontSize: fontSize*0.7,
                        pos: pos,
                        bounds: Bounds.forText(v.time.x.toString(), { x: pos.x, y: pos.y, fontSize: fontSize })
                    }
                }))
        })

        // Eliminate overlapping labels,
        _.each(renderData, d => { d.isActive = true })
        _.each(renderData, (d1, i) => {
            _.each(renderData.slice(i+1), d2 => {
                const intersect = d1.labels[0].bounds.intersects(d2.labels[0].bounds)
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

        _.each(renderData, d => {
            if (!d.isActive) return

            _.each(d.labels, (l1, i) => {
                _.each(d.labels.slice(i+1), l2 => {
                    //if (l1.bounds.intersects(l2.bounds))
                    //    l2.isHidden = true
                })
            })
        })

        return _.sortBy(renderData, d => d.isActive ? 1 : 0)
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
        const {hoverKey, focusKeys} = this
        if (!hoverKey) return

        if (_.includes(this.focusKeys, hoverKey))
            this.props.onSelectEntity(_.without(this.focusKeys, hoverKey))
        else
            this.props.onSelectEntity(this.focusKeys.concat([hoverKey]))
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
        return !!(this.tmpFocusKeys.length || this.renderData.length == 1)
    }

    render() {
        //Bounds.debug(_.flatten(_.map(this.renderData, d => _.map(d.labels, 'bounds'))))
        const {bounds, renderData, xScale, yScale, sizeScale, tmpFocusKeys, allColors, isFocusMode} = this
        window.p = this

        if (_.isEmpty(renderData))
            return <NoData bounds={bounds}/>

        const defaultOpacity = 1

        return <g class={styles.ScatterPlot}>
            <g class="entities" strokeOpacity={defaultOpacity} fillOpacity={defaultOpacity}>
                {_.map(renderData, d => {
                    const color = ((isFocusMode && !d.isFocused) || !d.isActive) ? "#e2e2e2" : d.color

                    return [
                        <defs key={d.displayKey+'-defs'}>
                            <marker key={d.displayKey} id={d.displayKey} fill={color} viewBox="0 -5 10 10" refx={5} refY={0} markerWidth={4} markerHeight={4} orient="auto">
                                <path d="M0,-5L10,0L0,5"/>
                            </marker>
                           <marker id={d.displayKey+'-start'} viewBox="0 0 12 12"
                                   refX={5} refY={5} orient="auto" fill={color}>
                             <circle cx={5} cy={5} r={5}/>
                           </marker>
                        </defs>,
                        <polyline
                            key={d.displayKey+'-line'}
                            class={d.displayKey}
                            strokeLinecap="round"
                            stroke={color}
                            strokeOpacity={d.isFocused && 1}
                            points={_.map(d.values, v => `${v.position.x},${v.position.y}`).join(' ')}
                            fill="none"
                            strokeWidth={d.isHovered ? 3 : (d.isFocused ? 2 : 0.5)}
                            markerStart={`url(#${d.displayKey}-start)`}
                            markerMid={`url(#${d.displayKey}-start)`}
                            markerEnd={`url(#${d.displayKey})`}
                        />
                    ]
                })}
            </g>
            <g class="labels">
                {_.map(renderData, d =>
                    _.map(d.labels, (l, i) =>
                        d.isActive && !l.isHidden && <text x={l.bounds.x} y={l.bounds.y+l.bounds.height+l.bounds.height/4} fontSize={l.fontSize} fontWeight={d.isHovered && "bold"} opacity={d.isFocused ? 1 : 0.8}>{l.text}</text>
                    )
                )}
                {_.map(renderData, d =>
                    d.isFocused && _.map(d.labels, (l, i) =>
                        l.normals && _.map(l.normals, n =>
                            <line x1={l.pos.x} y1={l.pos.y} x2={l.pos.x+n.x} y2={l.pos.y+n.y} stroke="blue"/>
                        )
                    )
                )}
            </g>
        </g>
    }
}
