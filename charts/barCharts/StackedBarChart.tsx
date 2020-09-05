import * as React from "react"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"

import { includes, guid, uniq, makeSafeForCSS } from "charts/utils/Util"
import { Grapher } from "charts/core/Grapher"
import { Bounds } from "charts/utils/Bounds"
import {
    VerticalAxisComponent,
    AxisTickMarks,
    VerticalAxisGridLines
} from "charts/axis/AxisViews"
import { VerticalAxis, DualAxis } from "charts/axis/Axis"
import { NoDataOverlay } from "charts/chart/NoDataOverlay"
import { Text } from "charts/text/Text"
import {
    VerticalColorLegend,
    ScatterColorLegendView
} from "charts/scatterCharts/ScatterColorLegend"
import { Tooltip } from "charts/chart/Tooltip"
import { EntityDimensionKey } from "charts/core/GrapherConstants"

export interface StackedBarValue {
    x: number
    y: number
    yOffset: number
    isFake: boolean
    label: string
}

export interface StackedBarSeries {
    entityDimensionKey: EntityDimensionKey
    label: string
    values: StackedBarValue[]
    color: string
}

interface StackedBarSegmentProps extends React.SVGAttributes<SVGGElement> {
    bar: StackedBarValue
    color: string
    opacity: number
    yAxis: VerticalAxis
    xOffset: number
    barWidth: number
    onBarMouseOver: (bar: StackedBarValue) => void
    onBarMouseLeave: () => void
}

@observer
class StackedBarSegment extends React.Component<StackedBarSegmentProps> {
    base: React.RefObject<SVGRectElement> = React.createRef()

    @observable mouseOver: boolean = false

    @computed get yPos() {
        const { bar, yAxis } = this.props
        return yAxis.place(bar.yOffset + bar.y)
    }

    @computed get barHeight() {
        const { bar, yAxis } = this.props
        const { yPos } = this

        return yAxis.place(bar.yOffset) - yPos
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
        const { color, xOffset, barWidth } = this.props
        const { yPos, barHeight, trueOpacity } = this

        return (
            <rect
                ref={this.base}
                x={xOffset}
                y={yPos}
                width={barWidth}
                height={barHeight}
                fill={color}
                opacity={trueOpacity}
                onMouseOver={this.onBarMouseOver}
                onMouseLeave={this.onBarMouseLeave}
            />
        )
    }
}

@observer
export class StackedBarChart extends React.Component<{
    bounds: Bounds
    chart: Grapher
}> {
    base!: SVGGElement
    readonly minBarSpacing = 4

    // currently hovered legend color
    @observable hoverColor?: string
    // current hovered individual bar
    @observable hoverBar?: StackedBarValue

    @computed get chart() {
        return this.props.chart
    }
    @computed get bounds(): Bounds {
        return this.props.bounds
    }
    @computed get transform() {
        return this.props.chart.stackedBarTransform
    }

    @computed get failMessage() {
        return this.chart.stackedBarTransform.failMessage
    }

    @computed get tickFontSize() {
        return 0.9 * this.props.chart.baseFontSize
    }

    @computed get barValueFormat() {
        return this.chart.stackedBarTransform.barValueFormat
    }

    @computed get barWidth() {
        const { transform, dualAxis } = this

        return (0.8 * dualAxis.innerBounds.width) / transform.xValues.length
    }

    @computed get barSpacing() {
        return (
            this.dualAxis.innerBounds.width / this.transform.xValues.length -
            this.barWidth
        )
    }

    @computed get barFontSize() {
        return 0.75 * this.props.chart.baseFontSize
    }

    // todo: Refactor
    @computed private get dualAxis() {
        const { bounds, transform, sidebarWidth } = this
        const { xAxis, yAxis } = transform
        return new DualAxis({
            bounds: bounds.padRight(sidebarWidth + 20),
            xAxis,
            yAxis
        })
    }

    @computed private get yAxis() {
        return this.dualAxis.yAxis
    }

    @computed get renderUid() {
        return guid()
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed get hoverKeys(): string[] {
        const { hoverColor, transform } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      transform.stackedData
                          .filter(g => g.color === hoverColor)
                          .map(g => g.entityDimensionKey)
                  )

        return hoverKeys
    }

    @computed get activeColors(): string[] {
        const { hoverKeys, transform } = this
        const activeKeys = hoverKeys.length > 0 ? hoverKeys : []

        let colors = []
        if (activeKeys.length === 0)
            // No hover means they're all active by default
            colors = uniq(transform.stackedData.map(g => g.color))
        else
            colors = uniq(
                transform.stackedData
                    .filter(
                        g => activeKeys.indexOf(g.entityDimensionKey) !== -1
                    )
                    .map(g => g.color)
            )
        return colors
    }

    // Only show colors on legend that are actually in use
    @computed get colorsInUse() {
        return uniq(this.transform.stackedData.map(g => g.color))
    }

    @computed get legend(): VerticalColorLegend {
        const that = this
        return new VerticalColorLegend({
            get maxWidth() {
                return that.sidebarMaxWidth
            },
            get fontSize() {
                return that.chart.baseFontSize
            },
            get colorables() {
                return that.transform.colorScale.legendData
                    .filter(bin => that.colorsInUse.includes(bin.color))
                    .map(bin => {
                        return {
                            key: bin.label ?? "",
                            label: bin.label ?? "",
                            color: bin.color
                        }
                    })
            }
        })
    }

    @computed get sidebarMaxWidth() {
        return this.bounds.width / 5
    }
    @computed get sidebarMinWidth() {
        return 100
    }
    @computed get sidebarWidth() {
        const { sidebarMinWidth, sidebarMaxWidth, legend } = this
        return Math.max(
            Math.min(legend.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    @computed get tooltip() {
        const { hoverBar, yAxis, mapXValueToOffset, barWidth } = this
        if (hoverBar === undefined) return

        const xPos = mapXValueToOffset.get(hoverBar.x)
        if (xPos === undefined) return

        const yPos = yAxis.place(hoverBar.yOffset + hoverBar.y)
        const { yFormatTooltip } = this.transform

        return (
            <Tooltip
                tooltipContainer={this.props.chart}
                x={xPos + barWidth}
                y={yPos}
                style={{ textAlign: "center" }}
            >
                <h3
                    style={{
                        padding: "0.3em 0.9em",
                        margin: 0,
                        backgroundColor: "#fcfcfc",
                        borderBottom: "1px solid #ebebeb",
                        fontWeight: "normal",
                        fontSize: "1em"
                    }}
                >
                    {hoverBar.label}
                </h3>
                <p
                    style={{
                        margin: 0,
                        padding: "0.3em 0.9em",
                        fontSize: "0.8em"
                    }}
                >
                    <span>{yFormatTooltip(hoverBar.y)}</span>
                    <br />
                    in
                    <br />
                    <span>{this.chart.formatYearFunction(hoverBar.x)}</span>
                </p>
            </Tooltip>
        )
    }

    @computed get mapXValueToOffset() {
        const { dualAxis, transform, barWidth, barSpacing } = this

        const xValueToOffset = new Map<number, number>()
        let xOffset = dualAxis.innerBounds.left + barSpacing

        for (let i = 0; i < transform.xValues.length; i++) {
            xValueToOffset.set(transform.xValues[i], xOffset)
            xOffset += barWidth + barSpacing
        }
        return xValueToOffset
    }

    // Place ticks centered beneath the bars, before doing overlap detection
    @computed private get tickPlacements() {
        const { mapXValueToOffset, barWidth, dualAxis } = this
        const { xValues } = this.transform
        const { xAxis } = dualAxis

        return xValues.map(x => {
            const text = xAxis.tickFormat(x)
            const xPos = mapXValueToOffset.get(x) as number

            const bounds = Bounds.forText(text, { fontSize: this.tickFontSize })
            return {
                text: text,
                bounds: bounds.extend({
                    x: xPos + barWidth / 2 - bounds.width / 2,
                    y: dualAxis.innerBounds.bottom + 5
                }),
                isHidden: false
            }
        })
    }

    @computed get ticks() {
        const { tickPlacements } = this

        for (let i = 0; i < tickPlacements.length; i++) {
            for (let j = 1; j < tickPlacements.length; j++) {
                const t1 = tickPlacements[i],
                    t2 = tickPlacements[j]

                if (t1 === t2 || t1.isHidden || t2.isHidden) continue

                if (t1.bounds.intersects(t2.bounds.padWidth(-5))) {
                    if (i === 0) t2.isHidden = true
                    else if (j === tickPlacements.length - 1) t1.isHidden = true
                    else t2.isHidden = true
                }
            }
        }

        return tickPlacements.filter(t => !t.isHidden)
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

    componentDidMount() {
        // Fancy intro animation

        const base = select(this.base)
        base.selectAll("clipPath > rect")
            .attr("width", 0)
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.bounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataOverlay
                    options={this.chart}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const {
            dualAxis,
            renderUid,
            bounds,
            yAxis,
            legend,
            sidebarWidth,
            activeColors,
            tooltip,
            barWidth,
            mapXValueToOffset,
            ticks
        } = this
        const { stackedData } = this.transform
        const { innerBounds } = dualAxis

        const textColor = "#666"

        return (
            <g className="StackedBarChart">
                <defs>
                    <clipPath id={`boundsClip-${renderUid}`}>
                        <rect
                            x={innerBounds.x}
                            y={innerBounds.y}
                            width={innerBounds.width}
                            height={innerBounds.height}
                        ></rect>
                    </clipPath>
                </defs>

                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                <VerticalAxisComponent
                    bounds={bounds}
                    verticalAxis={yAxis}
                    isInteractive={this.chart.isInteractive}
                />
                <VerticalAxisGridLines
                    verticalAxis={yAxis}
                    bounds={innerBounds}
                />

                <AxisTickMarks
                    tickMarkTopPosition={innerBounds.bottom}
                    tickMarkXPositions={ticks.map(tick => tick.bounds.centerX)}
                    color={textColor}
                />

                <g>
                    {ticks.map((tick, i) => {
                        return (
                            <Text
                                key={i}
                                x={tick.bounds.x}
                                y={tick.bounds.y}
                                fill={textColor}
                                fontSize={this.tickFontSize}
                            >
                                {tick.text}
                            </Text>
                        )
                    })}
                </g>

                <g clipPath={`url(#boundsClip-${renderUid})`}>
                    {stackedData.map(series => {
                        const isLegendHovered: boolean = includes(
                            this.hoverKeys,
                            series.entityDimensionKey
                        )
                        const opacity =
                            isLegendHovered || this.hoverKeys.length === 0
                                ? 0.8
                                : 0.2

                        return (
                            <g
                                key={series.entityDimensionKey}
                                className={
                                    makeSafeForCSS(series.entityDimensionKey) +
                                    "-segments"
                                }
                            >
                                {series.values.map(bar => {
                                    const xPos = mapXValueToOffset.get(
                                        bar.x
                                    ) as number
                                    const barOpacity =
                                        bar === this.hoverBar ? 1 : opacity

                                    return (
                                        <StackedBarSegment
                                            key={bar.x}
                                            bar={bar}
                                            color={series.color}
                                            xOffset={xPos}
                                            opacity={barOpacity}
                                            yAxis={yAxis}
                                            onBarMouseOver={this.onBarMouseOver}
                                            onBarMouseLeave={
                                                this.onBarMouseLeave
                                            }
                                            barWidth={barWidth}
                                        />
                                    )
                                })}
                            </g>
                        )
                    })}
                </g>

                <ScatterColorLegendView
                    legend={legend}
                    x={bounds.right - sidebarWidth}
                    y={bounds.top}
                    onMouseOver={this.onLegendMouseOver}
                    onMouseLeave={this.onLegendMouseLeave}
                    onClick={this.onLegendClick}
                    activeColors={activeColors}
                />
                {tooltip}
            </g>
        )
    }
}
