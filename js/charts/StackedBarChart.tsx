import * as React from 'react'
import { includes, intersection, sortBy, some, min, max, guid, uniq } from './Util'
import { computed, action, observable, autorun, runInAction, IReactionDisposer } from 'mobx'
import { observer } from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import AxisBox from './AxisBox'
import AxisScale from './AxisScale'
import VerticalAxis, { VerticalAxisView } from './VerticalAxis'
import NoData from './NoData'
import ScatterColorLegend, { ScatterColorLegendView } from './ScatterColorLegend'
import Tooltip from './Tooltip'

export interface StackedBarValue {
    x: number
    y: number
    yOffset: number
    isFake: boolean
    label: string
}

export interface StackedBarSeries {
    key: string
    label: string
    values: StackedBarValue[]
    color: string
}

interface BarProps extends React.SVGAttributes<SVGGElement> {
    bar: StackedBarValue
    color: string
    opacity: number
    yScale: AxisScale
    xOffset: number|undefined
    barWidth: number
    barSpacing: number
    onBarMouseOver: (bar: StackedBarValue) => void
    onBarMouseLeave: () => void
}

@observer
export class BarRenderer extends React.Component<BarProps> {
    base!: SVGGElement
    @observable mouseOver: boolean = false

    @computed get yPos() {
        const { bar, yScale } = this.props
        return yScale.place(bar.yOffset + bar.y)
    }

    @computed get barHeight() {
        const { bar, yScale } = this.props
        const { yPos } = this

        return yScale.place(bar.yOffset) - yPos
    }

    @computed get trueOpacity() {
        if (this.mouseOver) {
            return 1
        }
        return this.props.opacity
    }

    @action.bound onBarMouseOver() {
        this.mouseOver = true
        this.props.onBarMouseOver(this.props.bar)
    }

    @action.bound onBarMouseLeave() {
        this.mouseOver = false
        this.props.onBarMouseLeave()
    }

    render() {
        const { bar, color, opacity, xOffset, yScale, barWidth } = this.props
        const { yPos, barHeight, trueOpacity } = this

        return <g className="Bar">
            <rect x={xOffset} y={yPos} width={barWidth} height={barHeight} fill={color} opacity={trueOpacity} onMouseOver={this.onBarMouseOver} onMouseLeave={this.onBarMouseLeave} />
        </g>
    }
}

@observer
export default class StackedBarChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    base!: SVGGElement

    // currently hovered legend color
    @observable hoverColor?: string
    // current hovered individual bar
    @observable hoverBar?: StackedBarValue

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

    @computed get barWidth() {
        const { transform, axisBox } = this
        return 0.8 * axisBox.innerBounds.width / transform.xValues.length
    }

    @computed get barSpacing() {
        const { transform, axisBox } = this
        return (axisBox.innerBounds.width / transform.xValues.length) - this.barWidth
    }

    @computed get barFontSize() {
        return 0.75*this.props.chart.baseFontSize
    }

    @computed get axisBox(): AxisBox {
        const {bounds, transform, chart, sidebarWidth } = this
        const {xAxisSpec, yAxisSpec} = transform
        return new AxisBox({bounds: bounds.padRight(sidebarWidth + 20), fontSize: chart.baseFontSize, xAxis: xAxisSpec, yAxis: yAxisSpec})
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

    @computed get yAxis() {
        const that = this
        return new VerticalAxis({
            get scale() { return that.yScale },
            get fontSize() { return that.chart.baseFontSize },
            get labelText() { return that.transform.yAxisSpec.label }
        })
    }

    @computed get renderUid() {
        return guid()
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed get hoverKeys(): string[] {
        const { hoverColor, transform } = this

        const hoverKeys = hoverColor === undefined ? [] : uniq(transform.stackedData.filter(g => g.color === hoverColor).map(g => g.key))

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

    @computed get tooltip() {
        const { hoverBar, yScale, mapXValueToOffset, barWidth, barValueFormat } = this
        if (hoverBar === undefined) return

        const xPos = mapXValueToOffset.get(hoverBar.x)
        if (xPos === undefined) return

        const yPos = yScale.place(hoverBar.yOffset + hoverBar.y)

        console.log(hoverBar.label + ", " + hoverBar.x + " is on tooltip")

        return <Tooltip x={xPos + barWidth} y={yPos} style={{ textAlign: "center" }}>
            <h3 style={{ padding: "0.3em 0.9em", margin: 0, backgroundColor: "#fcfcfc", borderBottom: "1px solid #ebebeb", fontWeight: "normal", fontSize: "1em" }}>{hoverBar.label}</h3>
            <p style={{ margin: 0, padding: "0.3em 0.9em", fontSize: "0.8em", textAlign: "left" }}>
                <span>X Axis: {hoverBar.x}</span><br />
                <span>Y Axis: {barValueFormat(hoverBar)}</span>
            </p>
        </Tooltip>
    }

    @computed get mapXValueToOffset() {
        const { axisBox, transform, barWidth, barSpacing } = this

        const xValueToOffset = new Map<number, number>()
        let xOffset = axisBox.innerBounds.left + barWidth / 2

        transform.xValues.forEach(x => {
            xValueToOffset.set(x, xOffset)
            xOffset += barWidth + barSpacing
        })

        return xValueToOffset
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

    @action.bound onBarMouseOver(bar: StackedBarValue) {
        this.hoverBar = bar
    }

    @action.bound onBarMouseLeave() {
        this.hoverBar = undefined
    }

    render() {
        if (this.failMessage)
            return <NoData bounds={this.bounds} message={this.failMessage} />

        const { chart, axisBox, bounds, yScale, legend, sidebarWidth, focusColors, activeColors, tooltip, yAxis, barWidth, barSpacing, mapXValueToOffset } = this
        const { stackedData, xValues } = this.transform
        const { innerBounds } = axisBox

        return <g className="StackedBarChart">
            <rect x={bounds.left} y={bounds.top} width={bounds.width} height={bounds.height} opacity={0} fill="rgba(255,255,255,0)" />
            <VerticalAxisView bounds={bounds} axis={yAxis} />

            <line x1={innerBounds.left} y1={innerBounds.bottom} x2={innerBounds.right} y2={innerBounds.bottom} stroke="#ccc" />
            <line x1={innerBounds.left} y1={innerBounds.top} x2={innerBounds.left} y2={innerBounds.bottom} stroke="#ccc" />

            {xValues.map(x => {
                const xPos = mapXValueToOffset.get(x)
                return <text x={xPos} y={bounds.bottom} fill="#666" dominant-baseline="middle" textAnchor="start" fontSize={this.barFontSize}>{x}</text>
            })}

            {stackedData.map(series => {
                const isFocused: boolean = includes(this.focusKeys, series.key)
                const isHovered: boolean = includes(this.hoverKeys, series.key)
                const opacity = isHovered ? 1 : (isFocused ? 0.75 : 0.25)

                const seriesRenderers = []
                seriesRenderers.push(series.values.map(bar => {
                    const xPos = mapXValueToOffset.get(bar.x)
                    return <BarRenderer bar={bar} color={series.color} xOffset={xPos} opacity={opacity} yScale={yScale} onBarMouseOver={this.onBarMouseOver} onBarMouseLeave={this.onBarMouseLeave} barWidth={barWidth} barSpacing={barSpacing} />
                }))
                return seriesRenderers
            })}

            <ScatterColorLegendView legend={legend} x={bounds.right - sidebarWidth} y={bounds.top} onMouseOver={this.onLegendMouseOver} onMouseLeave={this.onLegendMouseLeave} onClick={this.onLegendClick} focusColors={focusColors} activeColors={activeColors} />
            {tooltip}
        </g>
    }
}
