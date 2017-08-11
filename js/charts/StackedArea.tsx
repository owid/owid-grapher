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
import {preInstantiate} from "./Util"
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

class StackedArea {
    props: StackedAreaProps

    @computed get renderData(): AreaRenderSeries[] {
        const {data, xScale, yScale} = this.props
        let renderData = _.map(data, series => {
            return {
                key: series.key,
                color: series.color,
                values: series.values.map(v => {
                    return {
                        x: xScale.place(v.x),
                        y: yScale.place(v.y)
                    }
                })
            }
        })

        return renderData.reverse()
    }

    constructor(props: StackedAreaProps) {
        this.props = props
    }
}

@observer
export class StackedAreaView extends React.Component<{ stackedArea: StackedArea }> {
    base: SVGGElement
    
    @observable hoverIndex: number|undefined = 0

    @action.bound onMouseMove(ev: React.MouseEvent<SVGGElement>) {
        const {renderData} = this.props.stackedArea
        const mouse = Vector2.fromArray(getRelativeMouse(this.base, ev))
        const closestPoint = _.sortBy(renderData[0].values, d => Math.abs(d.x - mouse.x))[0]
        const index = renderData[0].values.indexOf(closestPoint)
        this.hoverIndex = index
    }

    @computed get hoverData(): { x: number }|undefined {
        const {hoverIndex} = this
        if (hoverIndex === undefined) return undefined

        const hoverData = {}
        _.each(this.props.stackedArea.renderData, series => {
            hoverData.x = series.values[hoverIndex].x
//            series.values[hoverIndex]
        })

        return hoverData
    }

    render() {
        const {xScale, yScale} = this.props.stackedArea.props
        const {renderData} = this.props.stackedArea
        const {hoverData} = this

        const xBottomLeft = `${Math.round(xScale.range[0])},${Math.round(yScale.range[0])}`
        const xBottomRight = `${Math.round(xScale.range[1])},${Math.round(yScale.range[0])}`

        return <g className="Areas" opacity={0.7} onMouseMove={this.onMouseMove}>
            <rect x={xScale.range[0]} y={yScale.range[1]} width={xScale.range[1]-xScale.range[0]} height={yScale.range[0]-yScale.range[1]} opacity={0} fill="rgba(255,255,255,0)"/> 
            {_.map(renderData, series =>
                <polyline
                    key={series.key+'-line'}
                    strokeLinecap="round"
                    stroke={series.color}
                    points={xBottomLeft + ' ' + _.map(series.values, v => `${Math.round(v.x)},${Math.round(v.y)}`).join(' ') + ' ' + xBottomRight}
                    fill={series.color}
                    strokeWidth={1}
                    opacity={1}
                />,
            )}
            {hoverData && <line x1={hoverData.x} y1={yScale.range[0]} x2={hoverData.x} y2={yScale.range[1]} stroke="black"/>}
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
        const _this = this
        return new HeightedLegend({
            get maxWidth() { return 150 },
            get items() { return _this.legendItems }
        })
    }

    @computed get axisBox() {
        const {bounds, transform, legend} = this
        const {xAxis, yAxis} = transform
        return new AxisBox({bounds: bounds.padRight(legend.width+5), xAxis, yAxis})
    }

    @computed get stackedArea() {
        const _this = this
        return new StackedArea({
            get xScale() { return _this.axisBox.xScale },
            get yScale() { return _this.axisBox.yScale },
            get data() { return _this.transform.stackedData }
        })
    }

    render() {
        const {chart, bounds, axisBox, stackedArea, legend} = this
        return <g className="StackedArea">
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>
            <StackedAreaView stackedArea={stackedArea}/>
            <HeightedLegendView legend={legend} x={bounds.right-legend.width} yScale={axisBox.yScale} focusKeys={[]}/>
        </g>
    }
}
