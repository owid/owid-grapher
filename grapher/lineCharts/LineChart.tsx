import * as React from "react"
import {
    sortBy,
    sum,
    guid,
    getRelativeMouse,
    pointsToPath,
    minBy,
    flatten,
    last,
    exposeInstanceOnWindow,
} from "grapher/utils/Util"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis } from "grapher/axis/Axis"
import { PointVector } from "grapher/utils/PointVector"
import {
    LineLegend,
    LineLabelSeries,
    LineLegendManager,
} from "grapher/lineLegend/LineLegend"
import { ComparisonLine } from "grapher/scatterCharts/ComparisonLine"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { NoDataModal } from "grapher/noDataModal/NoDataModal"
import { extent } from "d3-array"
import {
    BASE_FONT_SIZE,
    SeriesName,
    ScaleType,
} from "grapher/core/GrapherConstants"
import { ColorSchemes } from "grapher/color/ColorSchemes"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartInterface } from "grapher/chart/ChartInterface"
import {
    LinesProps,
    LineChartSeries,
    LineChartManager,
} from "./LineChartConstants"
import { columnToLineChartSeriesArray } from "./LineChartUtils"
import { OwidTable } from "coreTable/OwidTable"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    makeClipPath,
    makeSelectionArray,
} from "grapher/chart/ChartUtils"

const BLUR_COLOR = "#eee"

@observer
class Lines extends React.Component<LinesProps> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed private get allValues() {
        return flatten(this.props.placedSeries.map((series) => series.points))
    }

    @action.bound private onCursorMove(ev: MouseEvent | TouchEvent) {
        const { dualAxis } = this.props
        const { horizontalAxis } = dualAxis

        const mouse = getRelativeMouse(this.base.current, ev)

        let hoverX
        if (dualAxis.innerBounds.contains(mouse)) {
            const closestValue = minBy(this.allValues, (point) =>
                Math.abs(horizontalAxis.place(point.x) - mouse.x)
            )
            hoverX = closestValue?.x
        }

        this.props.onHover(hoverX)
    }

    @action.bound private onCursorLeave() {
        this.props.onHover(undefined)
    }

    @computed get bounds() {
        const { horizontalAxis, verticalAxis } = this.props.dualAxis
        return Bounds.fromCorners(
            new PointVector(horizontalAxis.range[0], verticalAxis.range[0]),
            new PointVector(horizontalAxis.range[1], verticalAxis.range[1])
        )
    }

    @computed private get focusedLines() {
        const { focusedSeriesNames } = this.props
        // If nothing is focused, everything is
        if (!focusedSeriesNames.length) return this.props.placedSeries
        return this.props.placedSeries.filter((series) =>
            focusedSeriesNames.includes(series.seriesName)
        )
    }

    @computed private get backgroundLines() {
        const { focusedSeriesNames } = this.props
        return this.props.placedSeries.filter(
            (series) => !focusedSeriesNames.includes(series.seriesName)
        )
    }

    // Don't display point markers if there are very many of them for performance reasons
    // Note that we're using circle elements instead of marker-mid because marker performance in Safari 10 is very poor for some reason
    @computed private get hasMarkers() {
        if (this.props.hidePoints) return false
        return (
            sum(
                this.props.placedSeries.map(
                    (series) => series.placedPoints.length
                )
            ) < 500
        )
    }

    @computed private get strokeWidth() {
        return this.props.lineStrokeWidth ?? 1.5
    }

    private renderFocusGroups() {
        return this.focusedLines.map((series, index) => (
            <g key={index}>
                <path
                    stroke={series.color}
                    strokeLinecap="round"
                    d={pointsToPath(
                        series.placedPoints.map((value) => [
                            value.x,
                            value.y,
                        ]) as [number, number][]
                    )}
                    fill="none"
                    strokeWidth={this.strokeWidth}
                    strokeDasharray={series.isProjection ? "1,4" : undefined}
                />
                {this.hasMarkers && !series.isProjection && (
                    <g fill={series.color}>
                        {series.placedPoints.map((value, index) => (
                            <circle
                                key={index}
                                cx={value.x}
                                cy={value.y}
                                r={2}
                            />
                        ))}
                    </g>
                )}
            </g>
        ))
    }

    private renderBackgroundGroups() {
        return this.backgroundLines.map((series, index) => (
            <g key={index}>
                <path
                    key={`${series.seriesName}-${series.color}-line`}
                    strokeLinecap="round"
                    stroke="#ddd"
                    d={pointsToPath(
                        series.placedPoints.map((value) => [
                            value.x,
                            value.y,
                        ]) as [number, number][]
                    )}
                    fill="none"
                    strokeWidth={1}
                />
            </g>
        ))
    }

    private container?: SVGElement
    componentDidMount() {
        const base = this.base.current as SVGGElement
        const container = base.closest("svg") as SVGElement
        container.addEventListener("mousemove", this.onCursorMove)
        container.addEventListener("mouseleave", this.onCursorLeave)
        container.addEventListener("touchstart", this.onCursorMove)
        container.addEventListener("touchmove", this.onCursorMove)
        container.addEventListener("touchend", this.onCursorLeave)
        container.addEventListener("touchcancel", this.onCursorLeave)
        this.container = container
    }

    componentWillUnmount() {
        const { container } = this
        if (!container) return

        container.removeEventListener("mousemove", this.onCursorMove)
        container.removeEventListener("mouseleave", this.onCursorLeave)
        container.removeEventListener("touchstart", this.onCursorMove)
        container.removeEventListener("touchmove", this.onCursorMove)
        container.removeEventListener("touchend", this.onCursorLeave)
        container.removeEventListener("touchcancel", this.onCursorLeave)
    }

    render() {
        const { bounds } = this

        return (
            <g ref={this.base} className="Lines">
                <rect
                    x={Math.round(bounds.x)}
                    y={Math.round(bounds.y)}
                    width={Math.round(bounds.width)}
                    height={Math.round(bounds.height)}
                    fill="rgba(255,255,255,0)"
                    opacity={0}
                />
                {this.renderBackgroundGroups()}
                {this.renderFocusGroups()}
            </g>
        )
    }
}

@observer
export class LineChart
    extends React.Component<{
        bounds?: Bounds
        manager: LineChartManager
    }>
    implements ChartInterface, LineLegendManager {
    base: React.RefObject<SVGGElement> = React.createRef()

    transformTable(table: OwidTable) {
        table = table.filterBySelectedOnly(
            this.selectionArray.selectedEntityNames
        )

        if (this.isLogScale)
            table = table.replaceNonPositiveCellsForLogScale(
                this.manager.yColumnSlugs
            )

        return table
    }

    @computed get inputTable() {
        return this.manager.table
    }

    @computed private get transformedTableFromGrapher() {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get transformedTable() {
        let table = this.transformedTableFromGrapher
        // The % growth transform cannot be applied in transformTable() because it will filter out
        // any rows before startHandleTimeBound and change the timeline bounds.
        const { isRelativeMode, startHandleTimeBound } = this.manager
        if (isRelativeMode && startHandleTimeBound !== undefined) {
            table = table.toTotalGrowthForEachColumnComparedToStartTime(
                startHandleTimeBound,
                this.manager.yColumnSlugs ?? []
            )
        }
        return table
    }

    @observable hoverX?: number
    @action.bound onHover(hoverX: number | undefined) {
        this.hoverX = hoverX
    }

    @computed private get manager() {
        return this.props.manager
    }

    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get maxLegendWidth() {
        return this.bounds.width / 3
    }

    @computed get selectionArray() {
        return makeSelectionArray(this.manager)
    }

    seriesIsBlurred(series: LineChartSeries) {
        return (
            this.isFocusMode &&
            !this.focusedSeriesNames.includes(series.seriesName)
        )
    }

    @computed private get tooltip() {
        const { hoverX, dualAxis, inputTable } = this

        if (hoverX === undefined) return undefined

        const sortedData = sortBy(this.series, (series) => {
            const value = series.points.find((point) => point.x === hoverX)
            return value !== undefined ? -value.y : Infinity
        })

        const formatted = inputTable.timeColumnFormatFunction(hoverX)

        return (
            <Tooltip
                tooltipManager={this.manager}
                x={dualAxis.horizontalAxis.place(hoverX)}
                y={
                    dualAxis.verticalAxis.rangeMin +
                    dualAxis.verticalAxis.rangeSize / 2
                }
                style={{ padding: "0.3em" }}
                offsetX={5}
            >
                <table
                    style={{
                        fontSize: "0.9em",
                        lineHeight: "1.4em",
                        whiteSpace: "normal",
                    }}
                >
                    <tbody>
                        <tr>
                            <td colSpan={3}>
                                <strong>{formatted}</strong>
                            </td>
                        </tr>
                        {sortedData.map((series) => {
                            const value = series.points.find(
                                (point) => point.x === hoverX
                            )

                            const annotation = this.getAnnotationsForSeries(
                                series.seriesName
                            )

                            // It sometimes happens that data is missing for some years for a particular
                            // entity. If the user hovers over these years, we want to show a "No data"
                            // notice. However, we only want to show this notice when we are in the middle
                            // of a time series – when data points exist before and after the current year.
                            // Otherwise we want to entirely exclude the entity from the tooltip.
                            if (!value) {
                                const [startX, endX] = extent(
                                    series.points,
                                    (point) => point.x
                                )
                                if (
                                    startX === undefined ||
                                    endX === undefined ||
                                    startX > hoverX ||
                                    endX < hoverX
                                )
                                    return undefined
                            }

                            const isBlur =
                                this.seriesIsBlurred(series) ||
                                value === undefined
                            const textColor = isBlur ? "#ddd" : "#333"
                            const annotationColor = isBlur ? "#ddd" : "#999"
                            const circleColor = isBlur
                                ? BLUR_COLOR
                                : series.color
                            return (
                                <tr
                                    key={`${series.seriesName}-${series.color}`}
                                    style={{ color: textColor }}
                                >
                                    <td>
                                        <div
                                            style={{
                                                width: "10px",
                                                height: "10px",
                                                borderRadius: "5px",
                                                backgroundColor: circleColor,
                                                display: "inline-block",
                                                marginRight: "2px",
                                            }}
                                        />
                                    </td>
                                    <td
                                        style={{
                                            paddingRight: "0.8em",
                                            fontSize: "0.9em",
                                        }}
                                    >
                                        {series.seriesName}
                                        {annotation && (
                                            <span
                                                className="tooltipAnnotation"
                                                style={{
                                                    color: annotationColor,
                                                    fontSize: "90%",
                                                }}
                                            >
                                                {" "}
                                                {annotation}
                                            </span>
                                        )}
                                    </td>
                                    <td
                                        style={{
                                            textAlign: "right",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {!value
                                            ? "No data"
                                            : dualAxis.verticalAxis.formatTick(
                                                  value.y,
                                                  { noTrailingZeroes: false }
                                              )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </Tooltip>
        )
    }

    defaultRightPadding = 1

    @observable hoveredSeriesName?: SeriesName
    @action.bound onLegendClick() {
        if (this.manager.startSelectingWhenLineClicked)
            this.manager.isSelectingData = true
    }

    @action.bound onLegendMouseOver(seriesName: SeriesName) {
        this.hoveredSeriesName = seriesName
    }

    @action.bound onLegendMouseLeave() {
        this.hoveredSeriesName = undefined
    }

    @computed get focusedSeriesNames() {
        return this.hoveredSeriesName ? [this.hoveredSeriesName] : []
    }

    @computed get isFocusMode() {
        return this.focusedSeriesNames.length > 0
    }

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >
    componentDidMount() {
        if (!this.manager.isStaticSvg) this.runFancyIntroAnimation()
        exposeInstanceOnWindow(this)
    }

    private runFancyIntroAnimation() {
        this.animSelection = select(this.base.current)
            .selectAll("clipPath > rect")
            .attr("width", 0)
        this.animSelection
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.bounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
    }

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get renderUid() {
        return guid()
    }

    @computed get fontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get legendX(): number {
        return this.bounds.right - (this.legendDimensions?.width || 0)
    }

    @computed private get legendDimensions() {
        return this.manager.hideLegend
            ? undefined
            : new LineLegend({ manager: this })
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )

        const { manager, tooltip, dualAxis, hoverX, renderUid, bounds } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        const comparisonLines = manager.comparisonLines || []

        // The tiny bit of extra space in the clippath is to ensure circles centered on the very edge are still fully visible
        const clipPath = makeClipPath(renderUid, {
            x: dualAxis.innerBounds.x - 10,
            y: bounds.y - 18, // subtract 18 to reverse the padding after header in captioned chart
            width: bounds.width + 10,
            height: bounds.height * 2,
        })
        return (
            <g ref={this.base} className="LineChart">
                {clipPath.element}
                <DualAxisComponent
                    isInteractive={!manager.isStaticSvg}
                    dualAxis={dualAxis}
                    showTickMarks={true}
                />
                <g clipPath={clipPath.id}>
                    {comparisonLines.map((line, index) => (
                        <ComparisonLine
                            key={index}
                            dualAxis={dualAxis}
                            comparisonLine={line}
                        />
                    ))}
                    <LineLegend manager={this} />
                    <Lines
                        dualAxis={dualAxis}
                        placedSeries={this.placedSeries}
                        hidePoints={manager.hidePoints}
                        onHover={this.onHover}
                        focusedSeriesNames={this.focusedSeriesNames}
                        lineStrokeWidth={manager.lineStrokeWidth}
                    />
                </g>
                {hoverX !== undefined && (
                    <g className="hoverIndicator">
                        {this.series.map((series) => {
                            const value = series.points.find(
                                (point) => point.x === hoverX
                            )
                            if (!value || this.seriesIsBlurred(series))
                                return null

                            return (
                                <circle
                                    key={`${series.seriesName}-${series.color}`}
                                    cx={horizontalAxis.place(value.x)}
                                    cy={verticalAxis.place(value.y)}
                                    r={4}
                                    fill={series.color}
                                />
                            )
                        })}
                        <line
                            x1={horizontalAxis.place(hoverX)}
                            y1={verticalAxis.range[0]}
                            x2={horizontalAxis.place(hoverX)}
                            y2={verticalAxis.range[1]}
                            stroke="rgba(180,180,180,.4)"
                        />
                    </g>
                )}

                {tooltip}
            </g>
        )
    }

    @computed get failMessage() {
        const message = getDefaultFailMessage(this.manager)
        if (message) return message
        if (!this.series.length) return "No matching data"
        return ""
    }

    @computed private get yColumns() {
        return this.yColumnSlugs.map((slug) => this.transformedTable.get(slug))
    }

    @computed protected get yColumnSlugs() {
        return autoDetectYColumnSlugs(this.manager)
    }

    // todo: for now just works with 1 y column
    @computed private get annotationsMap() {
        return this.inputTable
            .getAnnotationColumnForColumn(this.yColumnSlugs[0])
            ?.getUniqueValuesGroupedBy(this.inputTable.entityNameSlug)
    }

    getAnnotationsForSeries(seriesName: SeriesName) {
        const annotationsMap = this.annotationsMap
        const annos = annotationsMap?.get(seriesName)
        return annos
            ? Array.from(annos.values())
                  .filter((anno) => anno)
                  .join(" & ")
            : undefined
    }

    @computed private get colorScheme() {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes[this.manager.baseColorScheme]
                : null) ?? ColorSchemes["owid-distinct"]
        )
    }

    @computed get seriesStrategy() {
        return autoDetectSeriesStrategy(this.manager)
    }

    @computed get isLogScale() {
        return this.yAxisConfig.scaleType === ScaleType.log
    }

    @computed get series() {
        const arrOfSeries: LineChartSeries[] = flatten(
            this.yColumns.map((col) =>
                columnToLineChartSeriesArray(col, this.seriesStrategy)
            )
        )

        this.colorScheme.assignColors(
            arrOfSeries,
            this.manager.invertColorScheme,
            this.inputTable.entityNameColorIndex,
            this.manager.seriesColorMap
        )
        return arrOfSeries
    }

    @computed get allPoints() {
        return flatten(this.series.map((series) => series.points))
    }

    @computed get placedSeries() {
        const { dualAxis } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        return this.series.map((series) => {
            return {
                ...series,
                placedPoints: series.points.map(
                    (point) =>
                        new PointVector(
                            Math.round(horizontalAxis.place(point.x)),
                            Math.round(verticalAxis.place(point.y))
                        )
                ),
            }
        })
    }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed get labelSeries(): LineLabelSeries[] {
        // If there are any projections, ignore non-projection legends
        // Bit of a hack
        let seriesToShow = this.series
        if (seriesToShow.some((series) => !!series.isProjection))
            seriesToShow = seriesToShow.filter((series) => series.isProjection)

        return seriesToShow.map((series) => {
            const { seriesName, color } = series
            const lastValue = last(series.points)!.y
            return {
                color,
                seriesName,
                // E.g. https://ourworldindata.org/grapher/size-poverty-gap-world
                label: this.manager.hideLegend ? "" : `${seriesName}`,
                annotation: this.getAnnotationsForSeries(seriesName),
                yValue: lastValue,
            }
        })
    }

    // todo: Refactor
    @computed private get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.bounds.padRight(
                this.legendDimensions
                    ? this.legendDimensions.width
                    : this.defaultRightPadding
            ),
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
        })
    }

    @computed get verticalAxis() {
        return this.dualAxis.verticalAxis
    }

    @computed private get horizontalAxisPart() {
        const { manager } = this
        const axisConfig =
            manager.xAxis ?? new AxisConfig(manager.xAxisConfig, this)
        if (manager.hideXAxis) axisConfig.hideAxis = true
        const axis = axisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(
            this.transformedTable.timeDomainFor(this.yColumnSlugs)
        )
        axis.scaleType = ScaleType.linear
        axis.tickFormatter = this.inputTable.timeColumn.formatForTick
        axis.hideFractionalTicks = true
        axis.hideGridlines = true
        return axis
    }

    @computed private get yAxisConfig() {
        const { manager } = this
        return manager.yAxis ?? new AxisConfig(manager.yAxisConfig, this)
    }

    @computed private get verticalAxisPart() {
        const { manager } = this
        const axisConfig = this.yAxisConfig
        if (manager.hideYAxis) axisConfig.hideAxis = true
        const yColumn = this.yColumns[0]
        const yDomain = this.transformedTable.domainFor(this.yColumnSlugs)
        const domain = axisConfig.domain
        const axis = axisConfig.toVerticalAxis()
        axis.updateDomainPreservingUserSettings([
            Math.min(domain[0], yDomain[0]),
            Math.max(domain[1], yDomain[1]),
        ])
        axis.hideFractionalTicks = yColumn.isAllIntegers // all y axis points are integral, don't show fractional ticks in that case
        axis.label = ""
        axis.tickFormatter = yColumn.formatForTick
        return axis
    }
}
