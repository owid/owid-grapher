import * as React from "react"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import {
    guid,
    uniq,
    makeSafeForCSS,
    cloneDeep,
    sortBy,
    max,
    defaultTo,
    flatten,
} from "grapher/utils/Util"
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
    VerticalColorLegendOptionsProvider,
} from "grapher/verticalColorLegend/VerticalColorLegend"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"
import { EntityName } from "coreTable/CoreTableConstants"
import {
    BASE_FONT_SIZE,
    TimeRange,
    ValueRange,
} from "grapher/core/GrapherConstants"
import { ColorScale, ColorScaleOptionsProvider } from "grapher/color/ColorScale"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartInterface } from "grapher/chart/ChartInterface"
import { ColorScaleConfig } from "grapher/color/ColorScaleConfig"
import {
    StackedBarSegmentProps,
    StackedBarValue,
    StackedBarSeries,
} from "./StackedBarChartConstants"

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
        options: ChartOptionsProvider
    }>
    implements
        ChartInterface,
        VerticalColorLegendOptionsProvider,
        ColorScaleOptionsProvider {
    base!: SVGGElement
    readonly minBarSpacing = 4

    // currently hovered legend color
    @observable hoverColor?: string
    // current hovered individual bar
    @observable hoverBar?: StackedBarValue

    @computed get options() {
        return this.props.options
    }
    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get baseFontSize() {
        return this.options.baseFontSize ?? BASE_FONT_SIZE
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

        let colors = []
        if (activeKeys.length === 0)
            // No hover means they're all active by default
            colors = uniq(this.marks.map((g) => g.color))
        else
            colors = uniq(
                this.marks
                    .filter((g) => activeKeys.indexOf(g.entityName) !== -1)
                    .map((g) => g.color)
            )
        return colors
    }

    // Only show colors on legend that are actually in use
    @computed private get colorsInUse() {
        return uniq(this.marks.map((g) => g.color))
    }

    @computed get fontSize() {
        return this.options.baseFontSize ?? BASE_FONT_SIZE
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
        return new VerticalColorLegend({ options: this })
    }

    @computed get tooltip() {
        const { hoverBar, verticalAxis, mapXValueToOffset, barWidth } = this
        if (hoverBar === undefined) return

        const xPos = mapXValueToOffset.get(hoverBar.x)
        if (xPos === undefined) return

        const yPos = verticalAxis.place(hoverBar.yOffset + hoverBar.y)
        const { yColumn } = this.options

        return (
            <Tooltip
                tooltipProvider={this.props.options}
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
                        {this.options.table.timeColumnFormatFunction(
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
                    options={this.options}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const {
            dualAxis,
            renderUid,
            bounds,
            verticalAxis,
            tooltip,
            barWidth,
            mapXValueToOffset,
            ticks,
        } = this
        const { marks } = this
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
                    verticalAxis={verticalAxis}
                    isInteractive={this.options.isInteractive}
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
                    {marks.map((series) => {
                        const isLegendHovered: boolean = this.hoverKeys.includes(
                            series.entityName
                        )
                        const opacity =
                            isLegendHovered || this.hoverKeys.length === 0
                                ? 0.8
                                : 0.2

                        return (
                            <g
                                key={series.entityName}
                                className={
                                    makeSafeForCSS(series.entityName) +
                                    "-segments"
                                }
                            >
                                {series.values.map((bar) => {
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

                <VerticalColorLegend options={this} />
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
        const { yColumns } = this.options
        if (!yColumns?.length) return "Missing variable"
        else if (
            this.groupedData.length === 0 ||
            this.groupedData[0].values.length === 0
        )
            return "No matching data"
        return ""
    }

    @computed get barValueFormat(): (datum: StackedBarValue) => string {
        return (datum: StackedBarValue) => datum.y.toString()
    }

    @computed get tickFormatFn(): (d: number) => string {
        const { yColumn } = this.options
        return yColumn ? yColumn.formatValueShort : (d: number) => `${d}`
    }

    @computed get xDomainDefault(): TimeRange {
        const { startTimelineTime, endTimelineTime } = this.yColumn
        return [startTimelineTime, endTimelineTime]
    }

    // TODO: Make XAxis generic
    @computed get horizontalAxis() {
        const { options, xDomainDefault } = this
        const axis = this.xAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(xDomainDefault)
        axis.column = options.table.timeColumn
        axis.hideGridlines = true
        axis.hideFractionalTicks = true
        return axis
    }

    @computed get yDomainDefault(): ValueRange {
        const lastSeries = this.marks[this.marks.length - 1]

        const yValues = lastSeries.values.map((d) => d.yOffset + d.y)
        return [0, defaultTo(max(yValues), 100)]
    }

    @computed get yAxis() {
        return this.options.yAxis || new AxisConfig()
    }

    @computed get xAxis() {
        return this.options.xAxis || new AxisConfig()
    }

    @computed get verticalAxis() {
        const { options, yDomainDefault } = this
        const axis = this.yAxis.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(yDomainDefault)
        axis.domain = [yDomainDefault[0], yDomainDefault[1]] // Stacked chart must have its own y domain
        axis.column = options.yColumn
        return axis
    }

    @computed get allStackedValues() {
        return flatten(this.marks.map((series) => series.values))
    }

    @computed get xValues() {
        return uniq(this.allStackedValues.map((bar) => bar.x))
    }

    @computed get groupedData() {
        const { options } = this
        const { table, yColumns } = options
        const {
            selectedEntityNameSet,
            selectedEntityNames,
            getLabelForEntityName,
        } = table

        if (!yColumns) return []

        let groupedData: StackedBarSeries[] = []

        const timelineTimes = yColumns[0].timelineTimes

        yColumns.forEach((column) => {
            const seriesByKey = new Map<EntityName, StackedBarSeries>()

            for (let i = 0; i <= column.times.length; i += 1) {
                const year = column.times[i]
                const entityName = column.entityNames[i]
                const value = +column.parsedValues[i]
                let series = seriesByKey.get(entityName)

                // Not a selected key, don't add any data for it
                if (!selectedEntityNameSet.has(entityName)) continue
                // Must be numeric
                if (isNaN(value)) continue
                // Stacked bar chart can't go negative!
                if (value < 0) continue
                // only consider years that are part of timeline to line up the bars
                if (!timelineTimes.includes(year)) continue

                if (!series) {
                    series = {
                        entityName,
                        label: getLabelForEntityName(entityName),
                        values: [],
                        color: "#fff", // Temp
                    }
                    seriesByKey.set(entityName, series)
                }
                series.values.push({
                    x: year,
                    y: value,
                    yOffset: 0,
                    isFake: false,
                    label: series.label,
                })
            }

            groupedData = groupedData.concat([
                ...Array.from(seriesByKey.values()),
            ])
        })

        // Now ensure that every series has a value entry for every year in the data
        groupedData.forEach((series) => {
            let i = 0

            while (i < timelineTimes.length) {
                const value = series.values[i] as StackedBarValue | undefined
                const expectedYear = timelineTimes[i]

                if (value === undefined || value.x > timelineTimes[i]) {
                    // console.log("series " + series.key + " needs fake bar for " + expectedYear)

                    const fakeY = 0
                    series.values.splice(i, 0, {
                        x: expectedYear,
                        y: fakeY,
                        yOffset: 0,
                        isFake: true,
                        label: series.label,
                    })
                }
                i += 1
            }
        })

        // Preserve order
        groupedData = sortBy(
            groupedData,
            (series) => -selectedEntityNames.indexOf(series.entityName)
        )

        return groupedData
    }

    @computed get colorScale() {
        return new ColorScale(this)
    }

    @computed get colorScaleConfig() {
        return this.options.colorScale ?? new ColorScaleConfig()
    }

    defaultBaseColorScheme = "stackedAreaDefault"
    hasNoDataBin = false

    @computed get categoricalValues() {
        return uniq(this.groupedData.map((d) => d.entityName)).reverse()
    }

    @computed private get yColumn() {
        return this.options.yColumns![0]
    }

    // Apply time filtering and stacking
    @computed get marks() {
        const { groupedData } = this

        if (!groupedData.length) return []

        const { startTimelineTime, endTimelineTime } = this.yColumn

        const stackedData = cloneDeep(groupedData)

        for (const series of stackedData) {
            series.color = this.colorScale.getColor(series.entityName) ?? "#ddd"
            series.values = series.values.filter(
                (v) => v.x >= startTimelineTime && v.x <= endTimelineTime
            )
        }

        // every subsequent series needs be stacked on top of previous series
        for (let i = 1; i < stackedData.length; i++) {
            for (let j = 0; j < stackedData[0].values.length; j++) {
                stackedData[i].values[j].yOffset =
                    stackedData[i - 1].values[j].y +
                    stackedData[i - 1].values[j].yOffset
            }
        }

        // if the total height of any stacked column is 0, remove it
        const keyIndicesToRemove: number[] = []
        const lastSeries = stackedData[stackedData.length - 1]
        lastSeries.values.forEach((bar, index) => {
            if (bar.yOffset + bar.y === 0) {
                keyIndicesToRemove.push(index)
            }
        })
        for (let i = keyIndicesToRemove.length - 1; i >= 0; i--) {
            stackedData.forEach((series) => {
                series.values.splice(keyIndicesToRemove[i], 1)
            })
        }

        return stackedData
    }
}
