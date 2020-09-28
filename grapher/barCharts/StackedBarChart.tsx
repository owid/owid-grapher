import * as React from "react"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import { guid, uniq, makeSafeForCSS, max, flatten } from "grapher/utils/Util"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import {
    VerticalAxisComponent,
    AxisTickMarks,
    VerticalAxisGridLines,
} from "grapher/axis/AxisViews"
import { DualAxis } from "grapher/axis/Axis"
import { NoDataOverlay } from "grapher/chart/NoDataOverlay"
import { Text } from "grapher/text/Text"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "grapher/verticalColorLegend/VerticalColorLegend"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { ChartManager } from "grapher/chart/ChartManager"
import { BASE_FONT_SIZE, TimeRange } from "grapher/core/GrapherConstants"
import { ColorScale, ColorScaleManager } from "grapher/color/ColorScale"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartInterface } from "grapher/chart/ChartInterface"
import { ColorScaleConfig } from "grapher/color/ColorScaleConfig"
import {
    StackedBarSegmentProps,
    StackedBarPoint,
    StackedBarSeries,
} from "./StackedBarChartConstants"
import { stackBars } from "./StackedBarChartUtils"

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
export class StackedBarChart
    extends React.Component<{
        bounds?: Bounds
        manager: ChartManager
    }>
    implements ChartInterface, VerticalColorLegendManager, ColorScaleManager {
    base!: SVGGElement
    readonly minBarSpacing = 4

    // currently hovered legend color
    @observable hoverColor?: string
    // current hovered individual bar
    @observable hoverBar?: StackedBarPoint

    @computed get manager() {
        return this.props.manager
    }
    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get baseFontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get tickFontSize() {
        return 0.9 * this.baseFontSize
    }

    @computed get barWidth() {
        const { dualAxis } = this

        return (0.8 * dualAxis.innerBounds.width) / this.xValues.length
    }

    @computed get barSpacing() {
        return (
            this.dualAxis.innerBounds.width / this.xValues.length -
            this.barWidth
        )
    }

    @computed get barFontSize() {
        return 0.75 * this.baseFontSize
    }

    // todo: Refactor
    @computed private get dualAxis() {
        const { bounds, sidebarWidth } = this
        const { horizontalAxis, verticalAxis } = this
        return new DualAxis({
            bounds: bounds.padRight(sidebarWidth + 20),
            horizontalAxis,
            verticalAxis,
        })
    }

    @computed get renderUid() {
        return guid()
    }

    // All currently hovered group keys, combining the legend and the main UI
    @computed get hoverKeys() {
        const { hoverColor } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      this.marks
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.entityName)
                  )

        return hoverKeys
    }

    @computed get activeColors() {
        const { hoverKeys } = this
        const activeKeys = hoverKeys.length > 0 ? hoverKeys : []

        if (!activeKeys.length)
            // No hover means they're all active by default
            return uniq(this.marks.map((g) => g.color))

        return uniq(
            this.marks
                .filter((g) => activeKeys.indexOf(g.entityName) !== -1)
                .map((g) => g.color)
        )
    }

    // Only show colors on legend that are actually in use
    @computed private get colorsInUse() {
        return uniq(this.marks.map((g) => g.color))
    }

    @computed get fontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get colorBins() {
        return this.colorScale.legendBins.filter((bin) =>
            this.colorsInUse.includes(bin.color)
        )
    }

    @computed get maxLegendWidth() {
        return this.sidebarMaxWidth
    }

    @computed get sidebarMaxWidth() {
        return this.bounds.width / 5
    }
    @computed get sidebarMinWidth() {
        return 100
    }
    @computed get sidebarWidth() {
        const { sidebarMinWidth, sidebarMaxWidth, legendDimensions } = this
        return Math.max(
            Math.min(legendDimensions.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    @computed private get legendDimensions(): VerticalColorLegend {
        return new VerticalColorLegend({ manager: this })
    }

    @computed get tooltip() {
        const {
            hoverBar,
            mapXValueToOffset,
            barWidth,
            dualAxis,
            yColumn,
        } = this
        if (hoverBar === undefined) return

        const xPos = mapXValueToOffset.get(hoverBar.x)
        if (xPos === undefined) return

        const yPos = dualAxis.verticalAxis.place(hoverBar.yOffset + hoverBar.y)

        return (
            <Tooltip
                tooltipManager={this.props.manager}
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
                        fontSize: "1em",
                    }}
                >
                    {hoverBar.label}
                </h3>
                <p
                    style={{
                        margin: 0,
                        padding: "0.3em 0.9em",
                        fontSize: "0.8em",
                    }}
                >
                    <span>{yColumn!.formatValueLong(hoverBar.y)}</span>
                    <br />
                    in
                    <br />
                    <span>
                        {this.manager.table.timeColumnFormatFunction(
                            hoverBar.x
                        )}
                    </span>
                </p>
            </Tooltip>
        )
    }

    @computed get mapXValueToOffset() {
        const { dualAxis, barWidth, barSpacing } = this

        const xValueToOffset = new Map<number, number>()
        let xOffset = dualAxis.innerBounds.left + barSpacing

        for (let i = 0; i < this.xValues.length; i++) {
            xValueToOffset.set(this.xValues[i], xOffset)
            xOffset += barWidth + barSpacing
        }
        return xValueToOffset
    }

    // Place ticks centered beneath the bars, before doing overlap detection
    @computed private get tickPlacements() {
        const { mapXValueToOffset, barWidth, dualAxis } = this
        const { xValues } = this
        const { horizontalAxis } = dualAxis

        return xValues.map((x) => {
            const text = horizontalAxis.formatTick(x)
            const xPos = mapXValueToOffset.get(x) as number

            const bounds = Bounds.forText(text, { fontSize: this.tickFontSize })
            return {
                text,
                bounds: bounds.extend({
                    x: xPos + barWidth / 2 - bounds.width / 2,
                    y: dualAxis.innerBounds.bottom + 5,
                }),
                isHidden: false,
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

        return tickPlacements.filter((t) => !t.isHidden)
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

    @action.bound onBarMouseOver(bar: StackedBarPoint) {
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
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const {
            dualAxis,
            renderUid,
            bounds,
            tooltip,
            barWidth,
            mapXValueToOffset,
            ticks,
        } = this
        const { marks } = this
        const { innerBounds, verticalAxis } = dualAxis

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
                    verticalAxis={verticalAxis}
                    isInteractive={this.manager.isInteractive}
                />
                <VerticalAxisGridLines
                    verticalAxis={verticalAxis}
                    bounds={innerBounds}
                />

                <AxisTickMarks
                    tickMarkTopPosition={innerBounds.bottom}
                    tickMarkXPositions={ticks.map(
                        (tick) => tick.bounds.centerX
                    )}
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
                    {marks.map((series, index) => {
                        const isLegendHovered = this.hoverKeys.includes(
                            series.entityName
                        )
                        const opacity =
                            isLegendHovered || this.hoverKeys.length === 0
                                ? 0.8
                                : 0.2

                        return (
                            <g
                                key={index}
                                className={
                                    makeSafeForCSS(series.entityName) +
                                    "-segments"
                                }
                            >
                                {series.points.map((bar, index) => {
                                    const xPos = mapXValueToOffset.get(
                                        bar.x
                                    ) as number
                                    const barOpacity =
                                        bar === this.hoverBar ? 1 : opacity

                                    return (
                                        <StackedBarSegment
                                            key={index}
                                            bar={bar}
                                            color={series.color}
                                            xOffset={xPos}
                                            opacity={barOpacity}
                                            yAxis={verticalAxis}
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

                <VerticalColorLegend manager={this} />
                {tooltip}
            </g>
        )
    }

    @computed get legendY() {
        return this.bounds.top
    }

    @computed get legendX() {
        return this.bounds.right - this.sidebarWidth
    }

    @computed get failMessage() {
        const { yColumn } = this
        if (!yColumn) return "Missing variable"

        if (!this.marks.length) return "No matching data"
        return ""
    }

    @computed get barValueFormat(): (datum: StackedBarPoint) => string {
        return (datum: StackedBarPoint) => datum.y.toString()
    }

    @computed get tickFormatFn(): (d: number) => string {
        const { yColumn } = this
        return yColumn ? yColumn.formatValueShort : (d: number) => `${d}`
    }

    @computed private get yColumn() {
        return this.table.get(
            this.manager.yColumnSlug ?? this.manager.yColumnSlugs![0]
        )
    }

    // TODO: Make XAxis generic
    @computed get horizontalAxis() {
        const { manager } = this
        const { startTimelineTime, endTimelineTime } = this.yColumn!
        const axis = this.xAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings([
            startTimelineTime,
            endTimelineTime,
        ])
        axis.formatColumn = manager.table.timeColumn
        axis.hideGridlines = true
        axis.hideFractionalTicks = true
        return axis
    }

    @computed get yAxis() {
        return this.manager.yAxis || new AxisConfig(undefined, this)
    }

    @computed get xAxis() {
        return this.manager.xAxis || new AxisConfig(undefined, this)
    }

    @computed get verticalAxis() {
        const lastSeries = this.marks[this.marks.length - 1]

        const yValues = lastSeries.points.map((d) => d.yOffset + d.y)
        const yDomainDefault: TimeRange = [0, max(yValues) ?? 100]

        const axis = this.yAxis.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(yDomainDefault)
        axis.domain = [yDomainDefault[0], yDomainDefault[1]] // Stacked chart must have its own y domain
        axis.formatColumn = this.yColumn
        return axis
    }

    @computed private get allStackedValues() {
        return flatten(this.marks.map((series) => series.points))
    }

    @computed private get xValues() {
        return uniq(this.allStackedValues.map((bar) => bar.x))
    }

    @computed get colorScale() {
        return new ColorScale(this)
    }

    @computed get colorScaleConfig() {
        return this.manager.colorScale ?? new ColorScaleConfig()
    }

    defaultBaseColorScheme = "stackedAreaDefault"
    hasNoDataBin = false

    @computed get categoricalValues() {
        return this.yColumns.map((col) => col.displayName).reverse()
    }

    @computed get table() {
        let table = this.manager.table
        table = table.filterBySelectedOnly()
        return table
    }

    @computed private get yColumns() {
        return (this.manager.yColumnSlugs || []).map(
            (slug) => this.table.get(slug)!
        )
    }

    @computed get marks() {
        const { yColumns } = this

        const seriesArr: StackedBarSeries[] = yColumns.map((col) => {
            const points = col.owidRows.map((row) => {
                return {
                    x: row.time,
                    y: row.value,
                    yOffset: 0,
                    label: col.displayName,
                } as StackedBarPoint
            })
            return {
                entityName: col.displayName,
                label: col.displayName,
                points,
                color: this.colorScale.getColor(col.displayName) ?? "#ddd", // temp
            }
        })

        stackBars(seriesArr)
        if (!seriesArr.length) return []

        // if the total height of any stacked column is 0, remove it
        const keyIndicesToRemove: number[] = []
        const lastSeries = seriesArr[seriesArr.length - 1]
        lastSeries.points.forEach((bar, index) => {
            if (bar.yOffset + bar.y === 0) keyIndicesToRemove.push(index)
        })
        for (let i = keyIndicesToRemove.length - 1; i >= 0; i--) {
            seriesArr.forEach((series) => {
                series.points.splice(keyIndicesToRemove[i], 1)
            })
        }

        return seriesArr
    }
}
