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
} from "../../clientUtils/Util"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds"
import { DualAxisComponent } from "../axis/AxisViews"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { PointVector } from "../../clientUtils/PointVector"
import {
    LineLegend,
    LineLabelSeries,
    LineLegendManager,
} from "../lineLegend/LineLegend"
import { ComparisonLine } from "../scatterCharts/ComparisonLine"
import { Tooltip } from "../tooltip/Tooltip"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { extent } from "d3-array"
import {
    BASE_FONT_SIZE,
    SeriesName,
    ScaleType,
    SeriesStrategy,
} from "../core/GrapherConstants"
import { ColorSchemes } from "../color/ColorSchemes"
import { AxisConfig, FontSizeManager } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import {
    LinesProps,
    LineChartSeries,
    LineChartManager,
    LinePoint,
    PlacedLineChartSeries,
} from "./LineChartConstants"
import { columnToLineChartSeriesArray } from "./LineChartUtils"
import { OwidTable } from "../../coreTable/OwidTable"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    getSeriesKey,
    makeClipPath,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { ColorScheme } from "../color/ColorScheme"
import { SelectionArray } from "../selection/SelectionArray"
import { CoreColumn } from "../../coreTable/CoreTableColumns"
import { PrimitiveType } from "../../coreTable/CoreTableConstants"

const BLUR_COLOR = "#eee"

@observer
class Lines extends React.Component<LinesProps> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed private get allValues(): LinePoint[] {
        return flatten(this.props.placedSeries.map((series) => series.points))
    }

    @action.bound private onCursorMove(ev: MouseEvent | TouchEvent): void {
        const { dualAxis } = this.props
        const { horizontalAxis } = dualAxis

        if (!this.base.current) return

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

    @action.bound private onCursorLeave(): void {
        this.props.onHover(undefined)
    }

    @computed get bounds(): Bounds {
        const { horizontalAxis, verticalAxis } = this.props.dualAxis
        return Bounds.fromCorners(
            new PointVector(horizontalAxis.range[0], verticalAxis.range[0]),
            new PointVector(horizontalAxis.range[1], verticalAxis.range[1])
        )
    }

    @computed private get focusedLines(): PlacedLineChartSeries[] {
        const { focusedSeriesNames } = this.props
        // If nothing is focused, everything is
        if (!focusedSeriesNames.length) return this.props.placedSeries
        return this.props.placedSeries.filter((series) =>
            focusedSeriesNames.includes(series.seriesName)
        )
    }

    @computed private get backgroundLines(): PlacedLineChartSeries[] {
        const { focusedSeriesNames } = this.props
        return this.props.placedSeries.filter(
            (series) => !focusedSeriesNames.includes(series.seriesName)
        )
    }

    // Don't display point markers if there are very many of them for performance reasons
    // Note that we're using circle elements instead of marker-mid because marker performance in Safari 10 is very poor for some reason
    @computed private get hasMarkers(): boolean {
        if (this.props.hidePoints) return false
        return (
            sum(this.focusedLines.map((series) => series.placedPoints.length)) <
            500
        )
    }

    @computed private get strokeWidth(): number {
        return this.props.lineStrokeWidth ?? 1.5
    }

    private renderFocusGroups(): JSX.Element[] {
        return this.focusedLines.map((series, index) => {
            // If the series only contains one point, then we will always want to show a marker/circle
            // because we can't draw a line.
            const showMarkers =
                (this.hasMarkers || series.placedPoints.length === 1) &&
                !series.isProjection

            return (
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
                        strokeDasharray={
                            series.isProjection ? "1,4" : undefined
                        }
                    />
                    {showMarkers && (
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
            )
        })
    }

    private renderBackgroundGroups(): JSX.Element[] {
        return this.backgroundLines.map((series, index) => (
            <g key={index}>
                <path
                    key={getSeriesKey(series, "line")}
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
    componentDidMount(): void {
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

    componentWillUnmount(): void {
        const { container } = this
        if (!container) return

        container.removeEventListener("mousemove", this.onCursorMove)
        container.removeEventListener("mouseleave", this.onCursorLeave)
        container.removeEventListener("touchstart", this.onCursorMove)
        container.removeEventListener("touchmove", this.onCursorMove)
        container.removeEventListener("touchend", this.onCursorLeave)
        container.removeEventListener("touchcancel", this.onCursorLeave)
    }

    render(): JSX.Element {
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
    implements ChartInterface, LineLegendManager, FontSizeManager {
    base: React.RefObject<SVGGElement> = React.createRef()

    transformTable(table: OwidTable): OwidTable {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        if (this.isLogScale)
            table = table.replaceNonPositiveCellsForLogScale(
                this.manager.yColumnSlugs
            )

        return table
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed private get transformedTableFromGrapher(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get transformedTable(): OwidTable {
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

    // todo: rename mouseHoverX -> hoverX and hoverX -> activeX
    @observable mouseHoverX?: number = undefined
    @action.bound onHover(hoverX: number | undefined): void {
        this.mouseHoverX = hoverX
    }

    @computed get hoverX() {
        return this.mouseHoverX ?? this.props.manager.annotation?.year
    }

    @computed private get manager(): LineChartManager {
        return this.props.manager
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get maxLegendWidth(): number {
        return this.bounds.width / 3
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    seriesIsBlurred(series: LineChartSeries): boolean {
        return (
            this.isFocusMode &&
            !this.focusedSeriesNames.includes(series.seriesName)
        )
    }

    @computed private get tooltip(): JSX.Element | undefined {
        const { hoverX, dualAxis, inputTable, formatColumn } = this

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
                                    key={getSeriesKey(series)}
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
                                            : formatColumn.formatValueShort(
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
    @action.bound onLegendClick(): void {
        if (this.manager.startSelectingWhenLineClicked)
            this.manager.isSelectingData = true
    }

    @action.bound onLegendMouseOver(seriesName: SeriesName): void {
        this.hoveredSeriesName = seriesName
    }

    @action.bound onLegendMouseLeave(): void {
        this.hoveredSeriesName = undefined
    }

    @computed get focusedSeriesNames(): string[] {
        const entityName =
            this.props.manager.annotation?.entityName ??
            this.hoveredSeriesName ??
            undefined
        return entityName ? [entityName] : []
    }

    @computed get isFocusMode(): boolean {
        return this.focusedSeriesNames.length > 0
    }

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >
    componentDidMount(): void {
        if (!this.manager.isExportingtoSvgOrPng) this.runFancyIntroAnimation()
        exposeInstanceOnWindow(this)
    }

    private runFancyIntroAnimation(): void {
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

    componentWillUnmount(): void {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get renderUid(): number {
        return guid()
    }

    @computed get fontSize(): number {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get legendX(): number {
        return this.bounds.right - (this.legendDimensions?.width || 0)
    }

    @computed private get legendDimensions(): LineLegend | undefined {
        return this.manager.hideLegend
            ? undefined
            : new LineLegend({ manager: this })
    }

    render(): JSX.Element {
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
                <DualAxisComponent dualAxis={dualAxis} showTickMarks={true} />
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
                                    key={getSeriesKey(series)}
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

    @computed get failMessage(): string {
        const message = getDefaultFailMessage(this.manager)
        if (message) return message
        if (!this.series.length) return "No matching data"
        return ""
    }

    @computed private get yColumns(): CoreColumn[] {
        return this.yColumnSlugs.map((slug) => this.transformedTable.get(slug))
    }

    @computed protected get yColumnSlugs(): string[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed private get formatColumn(): CoreColumn {
        return this.yColumns[0]
    }

    // todo: for now just works with 1 y column
    @computed private get annotationsMap(): Map<
        PrimitiveType,
        Set<PrimitiveType>
    > {
        return this.inputTable
            .getAnnotationColumnForColumn(this.yColumnSlugs[0])
            ?.getUniqueValuesGroupedBy(this.inputTable.entityNameSlug)
    }

    getAnnotationsForSeries(seriesName: SeriesName): string | undefined {
        const annotationsMap = this.annotationsMap
        const annos = annotationsMap?.get(seriesName)
        return annos
            ? Array.from(annos.values())
                  .filter((anno) => anno)
                  .join(" & ")
            : undefined
    }

    @computed private get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes[this.manager.baseColorScheme]
                : null) ?? ColorSchemes["owid-distinct"]
        )
    }

    @computed get seriesStrategy(): SeriesStrategy {
        const hasNormalAndProjectedSeries =
            this.yColumns.some((col) => col.isProjection) &&
            this.yColumns.some((col) => !col.isProjection)
        return autoDetectSeriesStrategy(
            this.manager,
            hasNormalAndProjectedSeries
        )
    }

    @computed get isLogScale(): boolean {
        return this.yAxisConfig.scaleType === ScaleType.log
    }

    @computed get series(): readonly LineChartSeries[] {
        const arrOfSeries: LineChartSeries[] = flatten(
            this.yColumns.map((col) =>
                columnToLineChartSeriesArray(
                    col,
                    this.seriesStrategy,
                    !!this.manager.canSelectMultipleEntities
                )
            )
        )

        this.colorScheme.assignColors(
            arrOfSeries,
            this.manager.invertColorScheme,
            this.seriesStrategy === SeriesStrategy.entity
                ? this.inputTable.entityNameColorIndex
                : this.inputTable.columnDisplayNameToColorMap,
            this.manager.seriesColorMap
        )
        return arrOfSeries
    }

    @computed get allPoints(): LinePoint[] {
        return flatten(this.series.map((series) => series.points))
    }

    @computed get placedSeries() {
        const { dualAxis } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        return this.series
            .slice()
            .reverse()
            .map((series) => {
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

    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.xAxisConfig, this)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const axis = this.xAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(
            this.transformedTable.timeDomainFor(this.yColumnSlugs)
        )
        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.inputTable.timeColumn
        axis.hideFractionalTicks = true
        axis.hideGridlines = true
        return axis
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                nice: true,
                ...this.manager.yAxisConfig,
            },
            this
        )
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const axisConfig = this.yAxisConfig
        const yDomain = this.transformedTable.domainFor(this.yColumnSlugs)
        const domain = axisConfig.domain
        const axis = axisConfig.toVerticalAxis()
        axis.updateDomainPreservingUserSettings([
            Math.min(domain[0], yDomain[0]),
            Math.max(domain[1], yDomain[1]),
        ])
        axis.hideFractionalTicks = this.yColumns.every(
            (yColumn) => yColumn.isAllIntegers
        ) // all y axis points are integral, don't show fractional ticks in that case
        axis.label = ""
        axis.formatColumn = this.formatColumn
        return axis
    }

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

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }
}
