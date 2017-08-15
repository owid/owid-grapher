/* StackedArea.tsx
 * ================
 *
 * A stacked area chart.
 *
 */

import * as React from 'react'
import * as _ from 'lodash'
import * as d3 from 'd3'
import * as $ from 'jquery'
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
export class Areas extends React.Component<{ xScale: AxisScale, yScale: AxisScale, data: StackedAreaSeries[] }> {
    base: SVGGElement
    
    @observable hoverIndex: number|undefined = 0

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>) {
        const {xScale, data} = this.props

        const mouse = Vector2.fromArray(getRelativeMouse(this.base, ev))
        const closestPoint = _.sortBy(data[0].values, d => Math.abs(xScale.place(d.x) - mouse.x))[0]
        const index = data[0].values.indexOf(closestPoint)
        this.hoverIndex = index
    }

    render() {
        const {xScale, yScale, data} = this.props

        const xBottomLeft = `${Math.round(xScale.range[0])},${Math.round(yScale.range[0])}`
        const xBottomRight = `${Math.round(xScale.range[1])},${Math.round(yScale.range[0])}`

        return <g className="Areas" opacity={0.7} onMouseMove={this.onMouseMove}>
            <rect x={xScale.range[0]} y={yScale.range[1]} width={xScale.range[1]-xScale.range[0]} height={yScale.range[0]-yScale.range[1]} opacity={0} fill="rgba(255,255,255,0)"/> 
            {data.map((series, i) => {
                const prevPoints = i == 0 ? [xBottomLeft, xBottomRight] : _.map(data[i-1].values, v => `${Math.round(xScale.place(v.x))},${Math.round(yScale.place(v.y))}`)
                const mainPoints = _.map(series.values, v => `${Math.round(xScale.place(v.x))},${Math.round(yScale.place(v.y))}`)
                const points = mainPoints.concat(_(prevPoints).clone().reverse())

                return <polyline
                    key={series.key+'-line'}
                    strokeLinecap="round"
                    stroke={series.color}
                    points={points.join(" ")}
                    fill={series.color}
                    strokeWidth={1}
                />
            }
            )}
            {/*hoverTarget && <g className="hoverIndicator">
                <line x1={hoverTarget.x} y1={yScale.range[0]} x2={hoverTarget.x} y2={yScale.range[1]} stroke="#fff"/>
                {hoverTarget.yValues.map(y => <circle cx={hoverTarget.x} cy={y} r={5} fill="#fff"/>)}
            </g>*/}
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
        return new AxisBox({bounds: bounds.padRight(legend ? legend.width+5 : 0), xAxis, yAxis})
    }

    render() {
        const {chart, bounds, axisBox, legend, transform} = this
        return <g className="StackedArea">
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>
            {legend && <HeightedLegendView legend={legend} x={bounds.right-legend.width} yScale={axisBox.yScale} focusKeys={[]}/>}
            <Areas xScale={axisBox.xScale} yScale={axisBox.yScale} data={transform.stackedData}/>
        </g>
    }
}
