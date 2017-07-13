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
import AxisScale from './AxisScale'

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


class StackedAreaLegendView extends React.Component<{ stackedArea: StackedArea, legend: Legend }, undefined> {
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
                        <Paragraph {...mark.label.props} x={x} y={yMid-mark.label.height/2}/>
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
}

interface StackedAreaProps {
    xScale: AxisScale,
    yScale: AxisScale,
    data: LineChartSeries[]    
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
export class StackedAreaView extends React.Component<{ stackedArea: StackedArea }, undefined> {
    render() {
        const {xScale, yScale} = this.props.stackedArea.props
        const {renderData} = this.props.stackedArea

        const xBottomLeft = `${Math.round(xScale.range[0])},${Math.round(yScale.range[0])}`
        const xBottomRight = `${Math.round(xScale.range[1])},${Math.round(yScale.range[0])}`

        return <g className="Areas" opacity={0.7}>
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
        </g>
    }
}

@observer
export default class StackedAreaChart extends React.Component<{ bounds: Bounds, chart: ChartConfig, localData: LineChartSeries[] }, undefined> {
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

    @computed get stackedData(): LineChartSeries[] {
        const {localData} = this
        
        if (_.some(localData, series => series.values.length !== localData[0].values.length))
            throw `Unexpected variation in stacked area chart series: ${_.map(localData, series => series.values.length)}`

        let stackedData = _.cloneDeep(localData)

        for (var i = 1; i < stackedData.length; i++) {
            for (var j = 0; j < stackedData[0].values.length; j++) {
                stackedData[i].values[j].y += stackedData[i-1].values[j].y
            }
        }

        return stackedData
    }

    @computed get yDomainDefault(): [number, number] {
        const {stackedData} = this
        return [0, (_(stackedData).map('values').flatten().map('y').max() as number)]
    }

    @computed get legend() {
        const _this = this
        return new Legend({
            get data() { return _this.stackedData }
        })
    }

    @computed get xAxis() {
        return this.chart.xAxis.toSpec({ defaultDomain: this.xDomainDefault })
    }

    @computed get yAxis() {
        return this.chart.yAxis.toSpec({ defaultDomain: this.yDomainDefault })
    }

    @computed get axisBox() {
        const {bounds, xAxis, yAxis, legend} = this
        return new AxisBox({bounds: bounds.padRight(legend.width), xAxis, yAxis})
    }

    @computed get stackedArea() {
        const _this = this
        return new StackedArea({
            get xScale() { return _this.axisBox.xScale },
            get yScale() { return _this.axisBox.yScale },
            get data() { return _this.stackedData }
        })
    }


    render() {
        const {chart, bounds, axisBox, stackedArea, legend} = this
        return <g className="StackedArea">
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>
            <StackedAreaView stackedArea={stackedArea}/>
            <StackedAreaLegendView stackedArea={stackedArea} legend={legend}/>
        </g>
    }
}
