/* LineChart.tsx
 * ================
 *
 * A standard line chart.
 *
 */

import * as React from 'react'
import * as _ from 'lodash'
import * as nv from '../libs/nvd3'
import * as d3 from '../libs/d3old'
import * as $ from 'jquery'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import LineType from './LineType'
import {defaultTo} from './Util'
import EntitySelect from './owid.view.entitySelect'
import AxisBox from './AxisBox'
import StandardAxisBoxView from './StandardAxisBoxView'
import Lines from './Lines'
import {preInstantiate} from "./Util"
import Paragraph from './Paragraph'

export interface LineChartValue {
    x: number,
    y: number,
    time: number,
    gapYearsToNext: number
}

export interface LineChartSeries {
    key: string,
    color: string,
    label: string
    values: LineChartValue[],
    classed?: string 
}

interface LegendData {
    label: string,
    color: string
}

interface LegendProps {
    x: (legend: Legend) => number
    y: number,
    maxHeight: number,
    children: (legend: Legend) => JSX.Element|JSX.Element[]
    data: LegendData[],
    focusColor?: string,
    onMouseOver?: (color: string) => void,
    onClick?: (color: string) => void,
    onMouseLeave?: () => void
}

class Legend extends React.Component<LegendProps, undefined> {
    @computed get fontSize(): number { return 0.8 }
    @computed get rectSize(): number { return 10 }
    @computed get rectPadding(): number { return 5 }
    @computed get lineHeight(): number { return 5 }
    @computed get onMouseOver(): Function { return this.props.onMouseOver || _.noop }
    @computed get onMouseLeave(): Function { return this.props.onMouseLeave || _.noop }
    @computed get onClick(): Function { return this.props.onClick || _.noop }
    @computed get focusColor(): string|null { return this.props.focusColor||null }
    @computed get columnWidth(): number { return 300 }

    @computed get labelMarks(): LabelMark[] {
        const {props, fontSize, rectSize, rectPadding, columnWidth} = this

        return _.map(props.data, series => {            
            const label = preInstantiate(<Paragraph maxWidth={columnWidth} fontSize={fontSize}>{series.label}</Paragraph>)
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

    render() {
        const {focusColor, rectSize, rectPadding, lineHeight} = this
        let offset = 0

        const x = this.props.x(this)
        const y = this.props.y

        return <g className="ColorLegend">
            <g className="clickable" style={{cursor: 'pointer'}}>
                {_.map(this.labelMarks, mark => {
                    const isFocus = mark.color == focusColor

                    const result = <g className="legendMark" onMouseOver={e => this.onMouseOver(mark.color)} onMouseLeave={e => this.onMouseLeave()} onClick={e => this.onClick(mark.color)}>
                        <rect x={x} y={y+offset-lineHeight/2} width={mark.width} height={mark.height+lineHeight} fill="#fff" opacity={0}/>,
                        <rect x={x} y={y+offset+rectSize/2} width={rectSize} height={rectSize} fill={mark.color}/>,
                        <Paragraph {...mark.label.props} x={x+rectSize+rectPadding} y={y+offset}/>
                    </g>

                    offset += mark.height+lineHeight
                    return result
                })}
            </g>
            {this.props.children(this)}            
        </g>
    }
}

@observer
export default class LineChart extends React.Component<{ bounds: Bounds, chart: ChartConfig, localData: LineChartSeries[] }, undefined> {
    @computed get chart() { return this.props.chart }
    @computed get bounds() { return this.props.bounds }

    @computed get localData(): LineChartSeries[] {
        return this.props.localData
    }

    @computed get allValues(): LineChartValue[] {
        return _.flatten(_.map(this.localData, series => series.values))
    }

    @computed get xDomainDefault(): [number, number] {
        return (d3.extent(this.allValues.map(function(d) { return d.x; })) as [number, number])
    }

    @computed get yDomainDefault(): [number, number] {
        return (d3.extent(this.allValues.map(function(d) { return d.y; })) as [number, number])
    }   

    render() {
        const {chart, bounds, localData, xDomainDefault, yDomainDefault} = this

        const xAxis = chart.xAxis.toSpec({ defaultDomain: xDomainDefault })
        const yAxis = chart.yAxis.toSpec({ defaultDomain: yDomainDefault })

        return <g className="LineChart">
            <Legend x={legend => bounds.right-legend.width} y={bounds.top} maxHeight={bounds.height} data={localData}>
                {legend => {
                    const axisBox = new AxisBox({bounds: bounds.padRight(legend.width), xAxis, yAxis})

                    return [
                        <StandardAxisBoxView axisBox={axisBox} chart={chart}/>,
                        <Lines xScale={axisBox.xScale} yScale={axisBox.yScale} data={localData}/>
                    ]
                }}
            </Legend>
        </g>
    }
}