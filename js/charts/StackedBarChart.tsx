import * as React from 'react'
import { select } from 'd3-selection'
import { sortBy, some, min, max, guid } from './Util'
import { computed, autorun, runInAction, IReactionDisposer } from 'mobx'
import { observer } from 'mobx-react'
import ChartConfig from './ChartConfig'
import StandardAxisBoxView from './StandardAxisBoxView'
import Bounds from './Bounds'
import AxisBox from './AxisBox'
import AxisScale from './AxisScale'
import Color from './Color'
import HorizontalAxis, { HorizontalAxisView } from './HorizontalAxis'
import VerticalAxis, { VerticalAxisView } from './VerticalAxis'
import { AxisGridLines } from './AxisBox'
import NoData from './NoData'

export interface StackedBarValue {
    x: number,
    y: number,
    yOffset: number,
    isFake: boolean
}

export interface StackedBarSeries {
    key: string
    values: StackedBarValue[],
    color: string
}

interface SeriesProps extends React.SVGAttributes<SVGGElement> {
    axisBox: AxisBox
    data: StackedBarSeries
    xScale: AxisScale
    yScale: AxisScale
}

interface BarProps extends React.SVGAttributes<SVGGElement> {
    bar: StackedBarValue
    color: string
    xScale: AxisScale
    yScale: AxisScale,
    axisBox: AxisBox
}

@observer
export class BarRenderer extends React.Component<BarProps> {
    base!: SVGGElement

    render() {
        const { bar, color, xScale, yScale, axisBox } = this.props

        const xPos = xScale.place(bar.x)
        const yPos = yScale.place(bar.yOffset + bar.y)
        const barHeight = yScale.place(bar.yOffset) - yPos
        const barWidth = 20

        return <g className="Bar">
            <rect x={xPos} y={yPos} width={barWidth} height={barHeight} fill={color} opacity={0.85} />
        </g>
    }
}

@observer
export class SeriesRenderer extends React.Component<SeriesProps> {
    base!: SVGGElement

    render() {
        const { axisBox, data, xScale, yScale } = this.props
        const { color } = data

        return <g className="SeriesBar">
            { data.values.map(barValue => {
                return <BarRenderer bar={barValue} color={color} xScale={xScale} yScale={yScale} axisBox={axisBox} />
            })}
        </g>
    }

}

@observer
export default class StackedBarChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    base!: SVGGElement

    @computed get chart() { return this.props.chart }
    @computed get bounds(): Bounds { return this.props.bounds }
    @computed get transform() { return this.props.chart.stackedBar }

    @computed get failMessage() {
        return this.chart.stackedBar.failMessage
    }

    @computed get legendFontSize() {
        return 0.85*this.props.chart.baseFontSize
    }

    // Account for the width of the legend
    // @computed get legendWidth() {
    //     const longestLabel = sortBy(this.data, d => -d.label.length)[0].label
    //     return Bounds.forText(longestLabel, { fontSize: this.legendFontSize }).width
    // }

    // Account for the width of the little value labels at the end of bars
    @computed get valueFontSize() {
        return 0.75*this.props.chart.baseFontSize
    }

    @computed get barValueFormat() {
        return this.chart.stackedBar.barValueFormat
    }

    @computed get axisBox(): AxisBox {
        const {bounds, transform, chart} = this
        const {xAxis, yAxis} = transform
        return new AxisBox({bounds: bounds.padRight(20), fontSize: chart.baseFontSize, xAxis, yAxis})
    }

    @computed get yRange() {
        const { axisBox } = this

        return [axisBox.innerBounds.bottom, axisBox.innerBounds.top]
    }

    @computed get xScale() {
        const { xDomainDefault } = this.transform
        const { innerBounds } = this.axisBox

        const xAxis = this.chart.yAxis.toSpec({ defaultDomain: xDomainDefault }) // XXX

        return new AxisScale(xAxis).extend({
            domain: xDomainDefault,
            range: [innerBounds.left, innerBounds.right]
        })
    }

    @computed get yScale() {
        const { yDomainDefault } = this.transform
        const yAxis = this.chart.yAxis.toSpec({ defaultDomain: yDomainDefault }) // XXX

        return new AxisScale(yAxis).extend({
            domain: yDomainDefault,
            range: this.yRange
        })
    }


    @computed get renderUid() {
        return guid()
    }

    render() {
        if (this.failMessage)
            return <NoData bounds={this.bounds} message={this.failMessage} />

        const { chart, axisBox, bounds, renderUid, xScale, yScale } = this
        const { stackedData } = this.transform
        const seriesT = stackedData[2]

        return <g className="StackedBarChart">
            <rect x={bounds.left} y={bounds.top} width={bounds.width} height={bounds.height} opacity={0} fill="rgba(255,255,255,0)" />
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>

            {stackedData.map(series => {
                return <SeriesRenderer axisBox={axisBox} data={series} xScale={xScale} yScale={yScale} />
            })}
        </g>
    }
}
