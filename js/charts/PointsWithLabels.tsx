/* PointsWithLabels.tsx
 * ================
 *
 * Core scatterplot renderer
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-03-09
 */

import * as React from 'react'
import * as _ from 'lodash'
import * as d3 from 'd3'
import {observable, computed, action, autorun} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import NoData from './NoData'
import AxisScale from './AxisScale'
import {getRelativeMouse, makeSafeForCSS} from './Util'
import Vector2 from './Vector2'
import {Triangle} from './Marks'

interface ScatterSeries {
    color: string,
    key: string,
    label: string,
    values: { x: number, y: number, size: number }[]
};

interface PointsWithLabelsProps {
    data: ScatterSeries[],
    focusKeys: string[],
    bounds: Bounds,
    xScale: AxisScale,
    yScale: AxisScale
}

interface ScatterRenderSeries {
    key: string,
    displayKey: string,
    color: string,
    size: number,
    fontSize: number,
    values: { position: Vector2, size: number, time: any }[],
    label: string,
    isActive: boolean,
    isHovered: boolean,
    isFocused: boolean
}

@observer
export default class PointsWithLabels extends React.Component<PointsWithLabelsProps, undefined> {
    @observable hoverKey : ?string = null

    @computed get focusKeys(): string[] {
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
        const sizeScale = d3.scaleLinear().range([3, 22])
        const allSizes = _.chain(data).map(series => _.map(series.values, 'size')).flatten().filter().value()
        if (allSizes.length == 0)
            return sizeScale.domain([1, 1])
        else
            return sizeScale.domain(d3.extent(allSizes))
    }

    @computed get fontScale() : Function {
        return d3.scaleLinear().range([10, 13]).domain(this.sizeScale.domain());
    }

    // Used if no color is specified for a series
    @computed get defaultColorScale() {
        return d3.scaleOrdinal().range(d3.schemeCategory20)
    }

    // Pre-transform data for rendering
    @computed get initialRenderData() : ScatterRenderSeries[] {
        window.Vector2 = Vector2
        const {data, xScale, yScale, defaultColorScale, sizeScale, fontScale} = this

        return _.sortBy(_.map(data, d => {
            const values = _.map(d.values, v => {
                return {
                    position: new Vector2(
                        Math.floor(xScale.place(v.x)),
                        Math.floor(yScale.place(v.y))
                    ),
                    size: sizeScale(v.size||1),
                    fontSize: fontScale(v.size||1),
                    time: v.time
                }
            })

            return {
                key: d.key,
                displayKey: "key-" + makeSafeForCSS(d.key),
                color: d.color || defaultColorScale(d.key),
                size: _.last(values).size,
                values: values,
                label: d.label
            }
        }), 'size')
    }

    labelPriority(d1: ScatterRenderSeries, d2: ScatterRenderSeries): ScatterRenderSeries {
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

    // Create the start year label for a series
    makeStartLabel(series: ScatterRenderSeries) {
        // No room to label the year if it's a single point        
        if (!series.isFocused || series.values.length <= 1)
            return null

        const fontSize = series.isFocused ? 9 : 7
        const firstValue = series.values[0]
        const nextValue = series.values[1]
        const nextSegment = nextValue.position.subtract(firstValue.position)

        let pos = firstValue.position.subtract(nextSegment.normalize().times(5))
        let bounds = Bounds.forText(firstValue.time.x.toString(), { x: pos.x, y: pos.y, fontSize: fontSize })
        if (pos.x < firstValue.position.x)
            bounds = new Bounds(bounds.x-bounds.width+2, bounds.y, bounds.width, bounds.height)
        if (pos.y > firstValue.position.y)
            bounds = new Bounds(bounds.x, bounds.y+bounds.height/2, bounds.width, bounds.height)

        return {
            text: firstValue.time.x.toString(),
            fontSize: fontSize,
            pos: firstValue.position,
            bounds: bounds,
            isStart: true
        }        
    }

    // Make labels for the points between start and end on a series
    // Positioned using normals of the line segments
    makeMidLabels(series: ScatterRenderSeries) {
        if (!series.isFocused || series.values.length <= 1)
            return []

        const fontSize = series.isFocused ? 9 : 7
        
        return _.map(series.values.slice(1, -1), (v, i) => {
            const prevPos = i > 0 && series.values[i-1].position
            const prevSegment = prevPos && v.position.subtract(prevPos)
            const nextPos = series.values[i+1].position
            const nextSegment = nextPos.subtract(v.position)

            let pos = v.position
            if (prevPos) {
                const normals = prevSegment.add(nextSegment).normalize().normals().map(x => x.times(5))
                const potentialSpots = _.map(normals, n => v.position.add(n))
                pos = _.sortBy(potentialSpots, p => {
                    return -(Vector2.distance(p, prevPos)+Vector2.distance(p, nextPos))
                })[0]
            } else {
                pos = v.position.subtract(nextSegment.normalize().times(5))
            }

            let bounds = Bounds.forText(v.time.x.toString(), { x: pos.x, y: pos.y, fontSize: fontSize})
            if (pos.x < v.position.x)
                bounds = new Bounds(bounds.x-bounds.width+2, bounds.y, bounds.width, bounds.height)
            if (pos.y > v.position.y)
                bounds = new Bounds(bounds.x, bounds.y+bounds.height/2, bounds.width, bounds.height)

            return {
                text: v.time.x.toString(),
                fontSize: fontSize,
                pos: v.position,
                bounds: bounds,
                isMid: true
            }
        }))
    }

    // Make the end label (entity label) for a series. Will be pushed
    // slightly out based on the direction of the series if multiple values
    // are present
    makeEndLabel(series: ScatterRenderSeries) {
        const lastValue = _.last(series.values)
        const lastPos = lastValue.position
        const fontSize = lastValue.fontSize*(series.isFocused ? 1.2 : 1)

        let offsetVector = Vector2.up
        if (series.values.length > 1) {
            const prevValue = series.values[series.values.length-2]
            const prevPos = prevValue.position
            offsetVector = lastPos.subtract(prevPos)
        }
        series.offsetVector = offsetVector

        const labelPos = lastPos.add(offsetVector.normalize().times(series.values.length == 1 ? lastValue.size+1 : 5))

        let labelBounds = Bounds.forText(series.label, { x: labelPos.x, y: labelPos.y, fontSize: fontSize })
        if (labelPos.x < lastPos.x)
            labelBounds = labelBounds.extend({ x: labelBounds.x-labelBounds.width })
        if (labelPos.y > lastPos.y)
            labelBounds = labelBounds.extend({ y: labelBounds.y+labelBounds.height/2 })

        return {
            text: series.label,
            fontSize: fontSize,
            bounds: labelBounds,
            isEnd: true
        }
    }

    @computed get renderData(): ScatterRenderSeries[] {
        let {initialRenderData, hoverKey, tmpFocusKeys, labelPriority, bounds} = this

        // Draw the largest points first so that smaller ones can sit on top of them
        let renderData = _.sortBy(initialRenderData, d => -d.size)

        _.each(renderData, series => {
            series.isHovered = series.key == hoverKey
            series.isFocused = _.includes(tmpFocusKeys, series.key)
        })

        _.each(renderData, series => {
            series.startLabel = this.makeStartLabel(series)
            series.midLabels = this.makeMidLabels(series)
            series.endLabel = this.makeEndLabel(series)
            series.allLabels = _.filter([series.startLabel].concat(series.midLabels).concat([series.endLabel]))
        })

        const allLabels = _.flatten(_.map(renderData, series => series.allLabels))

        // Ensure labels fit inside bounds
        // Must do before collision detection since it'll change the positions
        _.each(allLabels, l => {
            if (l.bounds.left < bounds.left-1) {
                l.bounds = l.bounds.extend({ x: l.bounds.x+l.bounds.width })
            } else if (l.bounds.right > bounds.right+1) {
                l.bounds = l.bounds.extend({ x: l.bounds.x-l.bounds.width })
            }
            
            if (l.bounds.top < bounds.top-1) {
                l.bounds = l.bounds.extend({ y: l.bounds.y + l.bounds.height })
            } else if (l.bounds.bottom > bounds.bottom+1) {
                l.bounds = l.bounds.extend({ y: l.bounds.y - l.bounds.height })
            }
        })

        // Main collision detection
        const labelsByPriority = _.sortBy(allLabels, l => -l.fontSize)
        for (var i = 0; i < labelsByPriority.length; i++) {
            const l1 = labelsByPriority[i]
            if (l1.isHidden) continue

            for (var j = i+1; j < labelsByPriority.length; j++) {
                const l2 = labelsByPriority[j]
                if (l2.isHidden) continue

                if (l1.bounds.intersects(l2.bounds)) {
                    l2.isHidden = true
                }
            }
        }

        return renderData
    }

    @computed get allColors() : string[] {
        return _.uniq(_.map(this.renderData, 'color'))
    }

    @observable focusKey = null

    base: SVGElement

    @action.bound onMouseLeave() {
        this.hoverKey = null
    }

    @action.bound onMouseMove(ev: any) {
        const mouse = Vector2.fromArray(getRelativeMouse(this.base, ev))

        const closestSeries = _.sortBy(this.renderData, (series) => {
//                    return _.min(_.map(series.values.slice(0, -1), (d, i) => {
//                        return Vector2.distanceFromPointToLineSq(mouse, d.position, series.values[i+1].position)
//                    }))
            return _.min(_.map(series.values, v => Vector2.distanceSq(v.position, mouse)))
        })[0]
        if (closestSeries) //&& _.min(_.map(closestSeries.values, v => Vector2.distance(v.position, mouse))) < 20)
            this.hoverKey = closestSeries.key
        else
            this.hoverKey = null

        if (this.props.onMouseOver && this.hoverKey)
            this.props.onMouseOver(_.find(this.data, d => d.key == this.hoverKey))        
        else if (this.props.onMouseLeave && !this.hoverKey)
            this.props.onMouseLeave()
    }

    @action.bound onClick() {
        const {hoverKey, focusKeys} = this
        if (!hoverKey) return

        if (_.includes(this.focusKeys, hoverKey))
            this.props.onSelectEntity(_.without(this.focusKeys, hoverKey))
        else
            this.props.onSelectEntity(this.focusKeys.concat([hoverKey]))
    }

    @computed get isFocusMode() : boolean {
        return !!(this.tmpFocusKeys.length || this.renderData.length == 1)
    }

    @computed get backgroundGroups(): ScatterRenderSeries[] {
        return _.filter(this.renderData, group => !group.isFocused)
    }

    @computed get focusGroups(): ScatterRenderSeries[] {
        return _.filter(this.renderData, group => group.isFocused)
    }

    // First pass: render the subtle polylines for background groups
    renderBackgroundLines() {
        const {backgroundGroups} = this

        return _.map(backgroundGroups, d => {
            if (d.values.length == 1)
                return null
            else {
                return <polyline
                    key={d.displayKey+'-line'}
                    strokeLinecap="round"
                    stroke={"#e2e2e2"}
                    points={_.map(d.values, v => `${v.position.x},${v.position.y}`).join(' ')}
                    fill="none"
                    strokeWidth={0.3}
                />                
            }
        })
    }

    // Second pass: render the starting points for each background group
    renderBackgroundStartPoints() {
        const {backgroundGroups, isFocusMode} = this
        return _.map(backgroundGroups, group => {
            if (group.values.length == 1)
                return null
            else {
                const firstValue = _.first(group.values)
                const color = !isFocusMode ? group.color : "#e2e2e2"

                //return <polygon transform={`translate(${firstValue.position.x}, ${firstValue.position.y}) scale(0.5) rotate(180)`} points="0,0 10,0 5.0,8.66" fill={color} opacity={0.4} stroke="#ccc"/>
                return <circle key={group.displayKey+'-start'} cx={firstValue.position.x} cy={firstValue.position.y} r={1.5} fill={!isFocusMode ? group.color : "#e2e2e2"} opacity={0.6} stroke="#ccc"/>
            }
        })
    }

    // Third pass: render the end points for each background group
    renderBackgroundEndPoints() {
        const {backgroundGroups, isFocusMode} = this
        return _.map(backgroundGroups, group => {
            const lastValue = _.last(group.values)
            const color = !isFocusMode ? group.color : "#e2e2e2"            
            let rotation = Vector2.angle(group.offsetVector, Vector2.up)
            if (group.offsetVector.x < 0) rotation = -rotation

            const cx = lastValue.position.x, cy = lastValue.position.y, r = lastValue.size
            if (group.values.length == 1) {
                return <circle key={group.displayKey+'-end'} cx={cx} cy={cy} r={r} fill={color} opacity={0.8} stroke="#ccc"/>
            } else {
                return <Triangle key={group.displayKey+'-end'} transform={`rotate(${rotation}, ${cx}, ${cy})`} cx={cx} cy={cy} r={2} fill={color} stroke="#ccc" strokeWidth={0.2} opacity={1}/>
            }
        })    
    }

    renderBackgroundLabels() {
        const {backgroundGroups, isFocusMode} = this
        return _.map(backgroundGroups, series => {
            return _.map(series.allLabels, l => 
                !l.isHidden && <text key={series.displayKey+'-endLabel'} 
                  x={l.bounds.x} 
                  y={l.bounds.y+l.bounds.height} 
                  fontSize={l.fontSize} 
                  fill={!isFocusMode ? "#333" : "#999"}>{l.text}</text>
            )
        })     
    }

    renderFocusLines() {
        const {focusGroups} = this
        
        return _.map(focusGroups, group => {
                const focusMul = (group.isHovered ? 3 : 2)
                const lastValue = _.last(group.values)

            if (group.values.length == 1) {
                const v = group.values[0]
                return <circle key={group.displayKey} cx={v.position.x} cy={v.position.y} fill={group.color} r={v.size}/>
            } else
                return [
                    <defs key={group.displayKey+'-defs'}>
                        <marker id={group.displayKey+'-arrow'} fill={group.color} viewBox="0 -5 10 10" refx={5} refY={0} markerWidth={4} markerHeight={4} orient="auto">
                            <path d="M0,-5L10,0L0,5"/>
                        </marker>
                        <marker id={group.displayKey+'-circle'} viewBox="0 0 12 12"
                                refX={5} refY={5} orient="auto" fill={group.color}>
                            <circle cx={5} cy={5} r={5}/>
                        </marker>
                    </defs>,
                    <polyline
                        key={group.displayKey+'-line'}
                        strokeLinecap="round"
                        stroke={group.color}
                        points={_.map(group.values, v => `${v.position.x},${v.position.y}`).join(' ')}
                        fill="none"
                        strokeWidth={focusMul}
                        markerStart={`url(#${group.displayKey}-circle)`}
                        markerMid={`url(#${group.displayKey}-circle)`}
                        markerEnd={`url(#${group.displayKey}-arrow)`}
                    />
                ]
        })      
    }

    renderFocusLabels() {
        const {focusGroups} = this
        return _.map(focusGroups, series => {
            return _.map(series.allLabels, (l, i) =>
                !l.isHidden && <text key={series.displayKey+'-label-'+i} x={l.bounds.x} y={l.bounds.y+l.bounds.height} fontSize={l.fontSize} fill="#333">{l.text}</text>
            )
        })
    }

    render() {
        //Bounds.debug(_.flatten(_.map(this.renderData, d => _.map(d.labels, 'bounds'))))
        const {bounds, renderData, xScale, yScale, sizeScale, tmpFocusKeys, allColors, isFocusMode} = this

        if (_.isEmpty(renderData))
            return <NoData bounds={bounds}/>

        return <g className="ScatterPlot" clipPath="url(#scatterBounds)" onMouseMove={this.onMouseMove} onMouseLeave={this.onMouseLeave} onClick={this.onClick}>
            <rect key="background" x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="rgba(0,0,0,0)"/>
            <defs>
                <clipPath id="scatterBounds">
                    <rect x={bounds.x-5} y={bounds.y-5} width={bounds.width+10} height={bounds.height+10}/>
                </clipPath>
            </defs>
            {this.renderBackgroundLines()}
            {this.renderBackgroundStartPoints()}
            {this.renderBackgroundEndPoints()}
            {this.renderBackgroundLabels()}
            {this.renderFocusLines()}
            {this.renderFocusLabels()}
        </g>
    }
}
