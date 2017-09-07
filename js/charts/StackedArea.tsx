/* StackedArea.tsx
 * ================
 *
 * A stacked area chart.
 *
 */

import * as React from 'react'
import * as _ from 'lodash'
import * as d3 from 'd3'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import LineType from './LineType'
import {defaultTo} from './Util'
import AxisBox from './AxisBox'
import StandardAxisBoxView from './StandardAxisBoxView'
import Lines from './Lines'
import TextWrap from './TextWrap'
import AxisScale from './AxisScale'
import Vector2 from './Vector2'
import {getRelativeMouse} from './Util'
import HeightedLegend, {HeightedLegendView} from './HeightedLegend'
import NoData from './NoData'
import Tooltip from './Tooltip'

export interface StackedAreaValue {
    x: number,
    y: number,
    time: number,
    gapYearsToNext?: number
}

export interface StackedAreaSeries {
    key: string,
    color: string,
    values: StackedAreaValue[],
    classed?: string,
    isProjection?: boolean
}

interface StackedAreaProps {
    xScale: AxisScale,
    yScale: AxisScale,
    data: StackedAreaSeries[]    
}

interface AreaRenderSeries {
    key: string,
    color: string,
    values: { x: number, y: number }[]
}

@observer
export class Areas extends React.Component<{ axisBox: AxisBox, data: StackedAreaSeries[], onHover: (hoverIndex: number|undefined) => void }> {
    base: SVGGElement
    
    @observable hoverIndex?: number

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>) {
        const {axisBox, data} = this.props

        const mouse = getRelativeMouse(this.base, ev)
        
        if (axisBox.innerBounds.contains(mouse)) {
            const closestPoint = _.sortBy(data[0].values, d => Math.abs(axisBox.xScale.place(d.x) - mouse.x))[0]
            const index = data[0].values.indexOf(closestPoint)
            this.hoverIndex = index
        } else {
            this.hoverIndex = undefined
        }

        this.props.onHover(this.hoverIndex)
    }

    @computed get polylines() {
        const {axisBox, data} = this.props
        const {xScale, yScale} = axisBox
        const xBottomLeft = `${_.identity(xScale.range[0])},${_.identity(yScale.range[0])}`
        const xBottomRight = `${_.identity(xScale.range[1])},${_.identity(yScale.range[0])}`

        return data.map((series, i) => {
            const prevPoints = i == 0 ? [xBottomLeft, xBottomRight] : _.map(data[i-1].values, v => `${_.identity(xScale.place(v.x))},${_.identity(yScale.place(v.y))}`)
            const mainPoints = _.map(series.values, v => `${_.identity(xScale.place(v.x))},${_.identity(yScale.place(v.y))}`)
            const points = mainPoints.concat(_(prevPoints).clone().reverse())

            return <polyline
                key={series.key+'-line'}
                strokeLinecap="round"
                stroke={series.color}
                points={points.join(" ")}
                fill={series.color}
                strokeWidth={1}
            />
        })
    }

    render() {
        const {axisBox, data} = this.props
        const {xScale, yScale} = axisBox
        const {hoverIndex} = this

        return <g className="Areas" opacity={0.7} onMouseMove={this.onMouseMove} onMouseLeave={this.onMouseMove}>
            <rect x={xScale.range[0]} y={yScale.range[1]} width={xScale.range[1]-xScale.range[0]} height={yScale.range[0]-yScale.range[1]} opacity={0} fill="rgba(255,255,255,0)"/> 
            {this.polylines}
            {hoverIndex != null && <g className="hoverIndicator">
                {data.map(series => {
                    return <circle cx={xScale.place(series.values[hoverIndex].x)} cy={yScale.place(series.values[hoverIndex].y)} r={5} fill={series.color}/>
                })}
                <line x1={xScale.place(data[0].values[hoverIndex].x)} y1={yScale.range[0]} x2={xScale.place(data[0].values[hoverIndex].x)} y2={yScale.range[1]} stroke="#ccc"/>
            </g>}
        </g>
    }
}

@observer
export default class StackedAreaChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    @computed get chart() { return this.props.chart }
    @computed get bounds() { return this.props.bounds }
    @computed get transform() { return this.props.chart.stackedArea }


    @computed get midpoints() {
        let prevY = 0
        return _.map(this.transform.stackedData, (series, i) => {
            const lastValue = _.last(series.values) as StackedAreaValue
            const middleY = prevY + (lastValue.y - prevY)/2
            prevY = lastValue.y
            return middleY
        })
    }

    @computed get legendItems() {
        const {transform, midpoints} = this
        return _(transform.stackedData).map((d, i) => ({
            color: d.color,
            key: d.key,
            label: this.chart.data.formatKey(d.key),
            yValue: midpoints[i]
        })).sortBy(d => d.yValue).value()
    }

    @computed get legend() {
        if (this.chart.hideLegend)
            return undefined

        const _this = this
        return new HeightedLegend({
            get maxWidth() { return 150 },
            get items() { return _this.legendItems }
        })
    }

    @computed get axisBox() {
        const {bounds, transform, legend} = this
        const {xAxis, yAxis} = transform
        return new AxisBox({bounds: bounds.padRight(legend ? legend.width+5 : 20), xAxis, yAxis})
    }

    @observable hoverIndex: number
    @action.bound onHover(hoverIndex: number) {
        this.hoverIndex = hoverIndex
    }

    @computed get tooltip() {
        if (this.hoverIndex == null) return undefined

        const {transform, hoverIndex, axisBox, chart} = this

        const refValue = transform.stackedData[0].values[hoverIndex]

        return <Tooltip x={axisBox.xScale.place(refValue.x)} y={axisBox.yScale.rangeMin + axisBox.yScale.rangeSize/2} style={{padding: "0.3em"}}>
            <table style={{fontSize: "0.9em", lineHeight: "1.4em"}}>
                <tr>
                    <td><strong>{refValue.x}</strong></td>
                    <td>
                        {!transform.isRelative && !transform.isDataRelative && <span>
                            <strong>{transform.yAxis.tickFormat(transform.stackedData[transform.stackedData.length-1].values[hoverIndex].y)}</strong>
                        </span>}
                    </td>
                </tr>
                {_(transform.groupedData).clone().reverse().map(series => {
                    return <tr>
                        <td style={{paddingRight: "0.8em", fontSize: "0.9em"}}>
                            <div style={{width: '10px', height: '10px', backgroundColor: series.color, border: "1px solid #ccc", display: 'inline-block'}}/> {chart.data.formatKey(series.key)}
                        </td>
                        <td>{transform.yAxis.tickFormat(series.values[hoverIndex].y)}</td>
                    </tr>
                })}
            </table>
        </Tooltip>
    }

    render() {
        if (this.transform.failMessage)
            return <NoData bounds={this.props.bounds} message={this.transform.failMessage}/>
            
        const {chart, bounds, axisBox, legend, transform} = this
        return <g className="StackedArea">
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>
            {legend && <HeightedLegendView legend={legend} x={bounds.right-legend.width} yScale={axisBox.yScale} focusKeys={[]}/>}
            <Areas axisBox={axisBox} data={transform.stackedData} onHover={this.onHover}/>
            {this.tooltip}
        </g>
    }
}
