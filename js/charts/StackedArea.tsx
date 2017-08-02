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

interface LegendData {
    label: string,
    color: string
}


class StackedAreaLegendView extends React.Component<{ stackedArea: StackedArea, legend: Legend }> {
    render() {
        const {rectSize, rectPadding, labelMarks} = this.props.legend
        const {areaMiddleHeights} = this.props.stackedArea
        const {xScale} = this.props.stackedArea.props

        const x = xScale.range[1] + 5

        return <g className="ColorLegend">
            <g className="clickable" style={{cursor: 'pointer'}}>
                {_.map(labelMarks, (mark, i) => {
                    const yMid = areaMiddleHeights[i]
                    const result = <g className="legendMark">
                        {/*<rect x={x} y={yMid-rectSize/2} width={rectSize} height={rectSize} fill={mark.color} opacity={0.7}/>*/},
                        {mark.label.render(x, yMid-mark.label.height/2)}
                    </g>
                    return result
                })}
            </g>
        </g>
    }
}

interface LegendProps {
    data: LegendData[]
}

class Legend {
    props: LegendProps
    constructor(props: LegendProps) {
        this.props = props
    }

    @computed get fontSize(): number { return 0.65 }
    @computed get rectSize(): number { return 10 }
    @computed get rectPadding(): number { return 5 }
    @computed get lineHeight(): number { return 5 }
    @computed get columnWidth(): number { return 300 }

    @computed get labelMarks(): LabelMark[] {
        const {props, fontSize, rectSize, rectPadding, columnWidth} = this

        return _.map(props.data, series => {
            const label = new TextWrap({ maxWidth: columnWidth, fontSize: fontSize, text: series.label })
            return {
                label: label,
                color: series.color,
                width: rectSize+rectPadding+label.width,
                height: Math.max(label.height, rectSize)
            }
        })
    }

    @computed get width(): number {
        if (this.labelMarks.length == 0)
            return 0   
        else 
            return _.max(_.map(this.labelMarks, 'width'))
    }

    @computed get height() {
        return _.sum(_.map(this.labelMarks, 'height')) + this.lineHeight*this.labelMarks.length
    }
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

    @computed get areaMiddleHeights() {
        const {data, yScale} = this.props
        let prevY = 0
        return _.map(data, (series, i) => {
            const lastValue = _.last(series.values)
            const middleY = prevY + (lastValue.y - prevY)/2
            prevY = lastValue.y
            return yScale.place(middleY)
        })
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

    @computed get axisBox() {
        const {bounds, transform} = this
        const {xAxis, yAxis} = transform
        return new AxisBox({bounds: bounds, xAxis, yAxis})
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
        const {chart, bounds, axisBox, stackedArea} = this
        return <g className="StackedArea">
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>
            <StackedAreaView stackedArea={stackedArea}/>
        </g>
    }
}
