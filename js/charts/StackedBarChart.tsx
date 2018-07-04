import * as React from 'react'
import { select } from 'd3-selection'
import { includes, intersection, sortBy, some, min, max, guid, uniq } from './Util'
import { computed, action, observable, autorun, runInAction, IReactionDisposer } from 'mobx'
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
import ScatterColorLegend, { ScatterColorLegendView } from './ScatterColorLegend'

export interface StackedBarValue {
    x: number,
    y: number,
    yOffset: number,
    isFake: boolean
}

export interface StackedBarSeries {
    key: string
    label: string
    values: StackedBarValue[]
    color: string
}

interface SeriesProps extends React.SVGAttributes<SVGGElement> {
    axisBox: AxisBox
    data: StackedBarSeries
    xScale: AxisScale
    yScale: AxisScale
    isFocused: boolean
    isHovered: boolean
}

interface BarProps extends React.SVGAttributes<SVGGElement> {
    bar: StackedBarValue
    color: string
    opacity: number
    xScale: AxisScale
    yScale: AxisScale
    axisBox: AxisBox
}

@observer
export class BarRenderer extends React.Component<BarProps> {
    base!: SVGGElement

    render() {
        const { bar, color, opacity, xScale, yScale, axisBox } = this.props

        const xPos = xScale.place(bar.x)
        const yPos = yScale.place(bar.yOffset + bar.y)
        const barHeight = yScale.place(bar.yOffset) - yPos
        const barWidth = 20

        return <g className="Bar">
            <rect x={xPos} y={yPos} width={barWidth} height={barHeight} fill={color} opacity={opacity} />
        </g>
    }
}

@observer
export class SeriesRenderer extends React.Component<SeriesProps> {
    base!: SVGGElement

    render() {
        const { axisBox, data, xScale, yScale, isFocused, isHovered } = this.props
        const { color } = data

        const opacity = isHovered ? 1 : (isFocused ? 0.5 : 0.25)

        console.log(data.key + " using opacity " + opacity)
        return <g className="SeriesBar">
            { data.values.map(barValue => {
                return <BarRenderer bar={barValue} color={color} opacity={opacity} xScale={xScale} yScale={yScale} axisBox={axisBox} />
            })}
        </g>
    }

}

@observer
export default class StackedBarChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    base!: SVGGElement

    // currently hovered individual series key
    @observable hoverKey?: string
    // currently hovered legend color
    @observable hoverColor?: string

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
        const {bounds, transform, chart, sidebarWidth } = this
        const {xAxis, yAxis} = transform
        return new AxisBox({bounds: bounds.padRight(sidebarWidth + 20), fontSize: chart.baseFontSize, xAxis, yAxis})
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

    // All currently hovered group keys, combining the legend and the main UI
    @computed get hoverKeys(): string[] {
        const { hoverColor, hoverKey, transform } = this

        const hoverKeys = hoverColor === undefined ? [] : uniq(transform.stackedData.filter(g => g.color === hoverColor).map(g => g.key))

        if (hoverKey !== undefined)
            hoverKeys.push(hoverKey)

        return hoverKeys
    }

    @computed get focusKeys(): string[] {
        return this.chart.data.selectedKeys
    }

    // Colors on the legend for which every matching group is focused
    @computed get focusColors(): string[] {
        const {legendColors, transform, chart} = this
        return legendColors.filter(color => {
            const matchingKeys = transform.stackedData.filter(g => g.color === color).map(g => g.key)
            return intersection(matchingKeys, chart.data.selectedKeys).length === matchingKeys.length
        })
    }

    @computed get activeColors(): string[] {
        const {hoverKeys, focusKeys, transform} = this
        const activeKeys = hoverKeys.length > 0 ? hoverKeys : focusKeys

        let colors = []
        if (activeKeys.length === 0) // No hover or focus means they're all active by default
            colors = uniq(transform.stackedData.map(g => g.color))
        else
            colors = uniq(transform.stackedData.filter(g => activeKeys.indexOf(g.key) !== -1).map(g => g.color))
        return colors
    }

    // Only show colors on legend that are actually in use
    @computed get legendColors() {
        return uniq(this.transform.stackedData.map(g => g.color))
    }

    @computed get legend(): ScatterColorLegend {
        const that = this
        return new ScatterColorLegend({
            get maxWidth() { return that.sidebarMaxWidth },
            get fontSize() { return that.chart.baseFontSize },
            get colors() { return that.legendColors },
            get scale() { return that.transform.colorScale }
        })
    }

    @computed get sidebarMaxWidth() { return this.bounds.width * 0.5 }
    @computed get sidebarMinWidth() { return 100 }
    @computed.struct get sidebarWidth() {
        const { sidebarMinWidth, sidebarMaxWidth, legend } = this
        return Math.max(Math.min(legend.width, sidebarMaxWidth), sidebarMinWidth)
    }

    @action.bound onLegendMouseOver(color: string) {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave() {
        this.hoverColor = undefined
    }

    @action.bound onLegendClick() {
        //
    }

    render() {
        if (this.failMessage)
            return <NoData bounds={this.bounds} message={this.failMessage} />

        const { chart, axisBox, bounds, renderUid, xScale, yScale, legend, sidebarWidth, focusColors, activeColors } = this
        const { stackedData } = this.transform

        return <g className="StackedBarChart">
            <rect x={bounds.left} y={bounds.top} width={bounds.width} height={bounds.height} opacity={0} fill="rgba(255,255,255,0)" />
            <StandardAxisBoxView axisBox={axisBox} chart={chart}/>

            {stackedData.map(series => {
                const isFocused: boolean = includes(this.focusKeys, series.key)
                const isHovered: boolean = includes(this.hoverKeys, series.key)

                return <SeriesRenderer axisBox={axisBox} data={series} xScale={xScale} yScale={yScale} isFocused={isFocused} isHovered={isHovered} />
            })}

            <ScatterColorLegendView legend={legend} x={bounds.right - sidebarWidth} y={bounds.top} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave} onClick={this.onLegendClick} focusColors={focusColors} activeColors={activeColors} />
        </g>
    }
}
