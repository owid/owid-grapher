import React from "react"
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
    round,
    excludeUndefined,
    isNumber,
    sortedUniqBy,
    isMobile,
} from "../../clientUtils/Util.js"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds.js"
import { DualAxisComponent } from "../axis/AxisViews.js"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis.js"
import { PointVector } from "../../clientUtils/PointVector.js"
import {
    LineLegend,
    LineLabelSeries,
    LineLegendManager,
} from "../lineLegend/LineLegend.js"
import { ComparisonLine } from "../scatterCharts/ComparisonLine.js"
import { Tooltip } from "../tooltip/Tooltip.js"
import { NoDataModal } from "../noDataModal/NoDataModal.js"
import { extent } from "d3-array"
import {
    BASE_FONT_SIZE,
    SeriesName,
    ScaleType,
    SeriesStrategy,
} from "../core/GrapherConstants.js"
import { ColorSchemes } from "../color/ColorSchemes.js"
import { AxisConfig, FontSizeManager } from "../axis/AxisConfig.js"
import { ChartInterface } from "../chart/ChartInterface.js"
import {
    LinesProps,
    LineChartSeries,
    LineChartManager,
    LinePoint,
    PlacedLineChartSeries,
    PlacedPoint,
} from "./LineChartConstants.js"
import { OwidTable } from "../../coreTable/OwidTable.js"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    getDefaultFailMessage,
    getSeriesKey,
    makeClipPath,
    makeSelectionArray,
} from "../chart/ChartUtils.js"
import { ColorScheme } from "../color/ColorScheme.js"
import { SelectionArray } from "../selection/SelectionArray.js"
import { CoreColumn } from "../../coreTable/CoreTableColumns.js"
import { CoreValueType } from "../../coreTable/CoreTableConstants.js"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin.js"
import { ColorScale, ColorScaleManager } from "../color/ColorScale.js"
import {
    ColorScaleConfig,
    ColorScaleConfigInterface,
} from "../color/ColorScaleConfig.js"
import { isNotErrorValue } from "../../coreTable/ErrorValues.js"
import { ColorSchemeName } from "../color/ColorConstants.js"
import { MultiColorPolyline } from "../scatterCharts/MultiColorPolyline.js"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner.js"
import { EntityName } from "../../coreTable/OwidTableConstants.js"
import {
    AxisAlign,
    Color,
    HorizontalAlign,
    PrimitiveType,
} from "../../clientUtils/owidTypes.js"
import {
    darkenColorForHighContrastText,
    darkenColorForLine,
} from "../color/ColorUtils.js"
import {
    HorizontalColorLegendManager,
    HorizontalNumericColorLegend,
} from "../horizontalColorLegend/HorizontalColorLegends.js"

// background
const BACKGROUND_COLOR = "#fff"
// line color
const BLUR_LINE_COLOR = "#eee"
const DEFAULT_LINE_COLOR = "#000"
// stroke width
const DEFAULT_STROKE_WIDTH = 1.5
const VARIABLE_COLOR_STROKE_WIDTH = 2.5
// marker radius
const DEFAULT_MARKER_RADIUS = 1.8
const VARIABLE_COLOR_MARKER_RADIUS = 2.2
// line outline
const DEFAULT_LINE_OUTLINE_WIDTH = 0.5
const VARIABLE_COLOR_LINE_OUTLINE_WIDTH = 1.0
// legend
const LEGEND_PADDING = 25

@observer
class Lines extends React.Component<LinesProps> {
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

    @computed private get markerRadius(): number {
        return this.props.markerRadius ?? DEFAULT_MARKER_RADIUS
    }

    @computed private get strokeWidth(): number {
        return this.props.lineStrokeWidth ?? DEFAULT_STROKE_WIDTH
    }

    @computed private get lineOutlineWidth(): number {
        return this.props.lineOutlineWidth ?? DEFAULT_LINE_OUTLINE_WIDTH
    }

    private renderFocusGroups(): JSX.Element[] {
        return this.focusedLines.map((series, index) => {
            // If the series only contains one point, then we will always want to show a marker/circle
            // because we can't draw a line.
            const showMarkers =
                (this.hasMarkers || series.placedPoints.length === 1) &&
                !series.isProjection
            const strokeDasharray = series.isProjection ? "2,3" : undefined

            return (
                <g key={index}>
                    {/*
                        Create a white outline around the lines so they're
                        easier to follow when they overlap.
                    */}
                    <path
                        fill="none"
                        strokeLinecap="butt"
                        strokeLinejoin="round"
                        stroke={BACKGROUND_COLOR}
                        strokeWidth={
                            this.strokeWidth + this.lineOutlineWidth * 2
                        }
                        strokeDasharray={strokeDasharray}
                        d={pointsToPath(
                            series.placedPoints.map((value) => [
                                value.x,
                                value.y,
                            ]) as [number, number][]
                        )}
                    />
                    <MultiColorPolyline
                        points={series.placedPoints}
                        strokeLinejoin="round"
                        strokeWidth={this.strokeWidth}
                        strokeDasharray={strokeDasharray}
                    />
                    {showMarkers && (
                        <g>
                            {series.placedPoints.map((value, index) => (
                                <circle
                                    key={index}
                                    cx={value.x}
                                    cy={value.y}
                                    r={this.markerRadius}
                                    fill={value.color}
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
                    strokeLinejoin="round"
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

    render(): JSX.Element {
        const { bounds } = this

        return (
            <g className="Lines">
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
    implements
        ChartInterface,
        LineLegendManager,
        FontSizeManager,
        ColorScaleManager,
        HorizontalColorLegendManager
{
    base: React.RefObject<SVGGElement> = React.createRef()

    transformTable(table: OwidTable): OwidTable {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        // Currently we set skipParsing=true on these columns to be backwards-compatible
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        if (this.isLogScale)
            table = table.replaceNonPositiveCellsForLogScale(this.yColumnSlugs)

        if (this.colorColumnSlug) {
            table = table
                // TODO: remove this filter once we don't have mixed type columns in datasets
                // Currently we set skipParsing=true on these columns to be backwards-compatible
                .replaceNonNumericCellsWithErrorValues([this.colorColumnSlug])
                .interpolateColumnWithTolerance(this.colorColumnSlug)
        }

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

    @action.bound private onCursorLeave(): void {
        this.onHover(undefined)
    }

    @computed private get allValues(): LinePoint[] {
        return flatten(this.placedSeries.map((series) => series.points))
    }

    @action.bound private onCursorMove(
        ev: React.MouseEvent | React.TouchEvent
    ): void {
        if (!this.base.current) return

        const mouse = getRelativeMouse(this.base.current, ev)

        const boxPadding = isMobile() ? 44 : 25

        // expand the box width, so it's easier to see the tooltip for the first & last timepoints
        const boundedBox = this.dualAxis.innerBounds.expand({
            left: boxPadding,
            right: boxPadding,
        })

        let hoverX
        if (boundedBox.contains(mouse)) {
            const closestValue = minBy(this.allValues, (point) =>
                Math.abs(this.dualAxis.horizontalAxis.place(point.x) - mouse.x)
            )
            hoverX = closestValue?.x
        }

        this.onHover(hoverX)
    }

    @observable hoverX?: number = undefined

    @action.bound onHover(hoverX: number | undefined): void {
        this.hoverX = hoverX
    }

    @computed get activeX(): number | undefined {
        return this.hoverX ?? this.props.manager.annotation?.year
    }

    @computed private get manager(): LineChartManager {
        return this.props.manager
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get boundsWithoutColorLegend(): Bounds {
        return this.bounds.padTop(
            this.hasColorLegend ? this.legendHeight + LEGEND_PADDING : 0
        )
    }

    @computed get maxLineLegendWidth(): number {
        return this.bounds.width / 3
    }

    @computed private get lineStrokeWidth(): number {
        return (
            this.manager.lineStrokeWidth ??
            (this.hasColorScale
                ? VARIABLE_COLOR_STROKE_WIDTH
                : DEFAULT_STROKE_WIDTH)
        )
    }

    @computed private get lineOutlineWidth(): number {
        return this.hasColorScale
            ? VARIABLE_COLOR_LINE_OUTLINE_WIDTH
            : DEFAULT_LINE_OUTLINE_WIDTH
    }

    @computed private get markerRadius(): number {
        return this.hasColorScale
            ? VARIABLE_COLOR_MARKER_RADIUS
            : DEFAULT_MARKER_RADIUS
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

    @computed get activeXVerticalLine(): JSX.Element | undefined {
        const { activeX, dualAxis } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        if (activeX === undefined) return undefined

        return (
            <g className="hoverIndicator">
                <line
                    x1={horizontalAxis.place(activeX)}
                    y1={verticalAxis.range[0]}
                    x2={horizontalAxis.place(activeX)}
                    y2={verticalAxis.range[1]}
                    stroke="rgba(180,180,180,.4)"
                />
                {this.series.map((series) => {
                    const value = series.points.find(
                        (point) => point.x === activeX
                    )
                    if (!value || this.seriesIsBlurred(series)) return null

                    return (
                        <circle
                            key={getSeriesKey(series)}
                            cx={horizontalAxis.place(value.x)}
                            cy={verticalAxis.place(value.y)}
                            r={this.lineStrokeWidth / 2 + 3.5}
                            fill={
                                this.hasColorScale
                                    ? this.getColorScaleColor(value.colorValue)
                                    : series.color
                            }
                            stroke="#fff"
                            strokeWidth={0.5}
                        />
                    )
                })}
            </g>
        )
    }

    @computed private get tooltip(): JSX.Element | undefined {
        const { activeX, dualAxis, inputTable, formatColumn, hasColorScale } =
            this

        if (activeX === undefined) return undefined

        const sortedData = sortBy(this.series, (series) => {
            const value = series.points.find((point) => point.x === activeX)
            return value !== undefined ? -value.y : Infinity
        })

        const formatted = inputTable.timeColumnFormatFunction(activeX)

        return (
            <Tooltip
                id={this.renderUid}
                tooltipManager={this.manager}
                x={dualAxis.horizontalAxis.place(activeX)}
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
                    <thead>
                        <tr>
                            <td colSpan={3}>
                                <strong>{formatted}</strong>
                            </td>
                            {hasColorScale && (
                                <td
                                    style={{
                                        paddingLeft: "0.5em",
                                        fontSize: "0.9em",
                                        color: "#999",
                                        whiteSpace: "normal",
                                        maxWidth: "5em",
                                        textAlign: "right",
                                        lineHeight: "1.1em",
                                    }}
                                >
                                    {this.colorScale.legendDescription}
                                </td>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((series) => {
                            const value = series.points.find(
                                (point) => point.x === activeX
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
                                    startX > activeX ||
                                    endX < activeX
                                )
                                    return undefined
                            }

                            const isBlur =
                                this.seriesIsBlurred(series) ||
                                value === undefined
                            const circleColor = isBlur
                                ? BLUR_LINE_COLOR
                                : this.hasColorScale
                                ? this.getColorScaleColor(value.colorValue)
                                : series.color
                            const textColor = isBlur
                                ? "#ddd"
                                : darkenColorForHighContrastText(circleColor)
                            const annotationColor = isBlur ? "#ddd" : "#999"
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
                                            fontWeight: 700,
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
                                            fontWeight: 700,
                                        }}
                                    >
                                        {value === undefined
                                            ? "No data"
                                            : formatColumn.formatValueShort(
                                                  value.y,
                                                  { trailingZeroes: true }
                                              )}
                                    </td>
                                    {hasColorScale && (
                                        <td
                                            style={{
                                                textAlign: "right",
                                                whiteSpace: "nowrap",
                                                fontSize: "0.95em",
                                                paddingLeft: "0.5em",
                                            }}
                                        >
                                            {value?.colorValue !== undefined
                                                ? this.colorColumn.formatValueShort(
                                                      value.colorValue,
                                                      {
                                                          trailingZeroes: true,
                                                      }
                                                  )
                                                : undefined}
                                        </td>
                                    )}
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
    @action.bound onLineLegendClick(): void {
        if (this.manager.startSelectingWhenLineClicked)
            this.manager.isSelectingData = true
    }

    @action.bound onLineLegendMouseOver(seriesName: SeriesName): void {
        this.hoveredSeriesName = seriesName
    }

    @action.bound onLineLegendMouseLeave(): void {
        this.hoveredSeriesName = undefined
    }

    @computed get focusedSeriesNames(): string[] {
        const { externalLegendFocusBin } = this.manager
        const focusedSeriesNames = excludeUndefined([
            this.props.manager.annotation?.entityName,
            this.hoveredSeriesName,
        ])
        if (externalLegendFocusBin) {
            focusedSeriesNames.push(
                ...this.series
                    .map((s) => s.seriesName)
                    .filter((name) => externalLegendFocusBin.contains(name))
            )
        }
        return focusedSeriesNames
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
        if (!this.manager.disableIntroAnimation) {
            this.runFancyIntroAnimation()
        }
        exposeInstanceOnWindow(this)
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

    @computed get fontWeight(): number {
        return this.hasColorScale ? 700 : 400
    }

    @computed get lineLegendX(): number {
        return this.bounds.right - (this.lineLegendDimensions?.width || 0)
    }

    @computed get clipPathBounds(): Bounds {
        const { dualAxis, boundsWithoutColorLegend } = this
        return boundsWithoutColorLegend
            .set({ x: dualAxis.innerBounds.x })
            .expand(10)
    }

    @computed get clipPath(): { id: string; element: JSX.Element } {
        return makeClipPath(this.renderUid, this.clipPathBounds)
    }

    private runFancyIntroAnimation(): void {
        this.animSelection = select(this.base.current)
            .selectAll("clipPath > rect")
            .attr("width", 0)
        this.animSelection
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.clipPathBounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
    }

    @computed private get lineLegendDimensions(): LineLegend | undefined {
        return this.manager.hideLegend
            ? undefined
            : new LineLegend({ manager: this })
    }

    render(): JSX.Element {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const { manager, tooltip, dualAxis, clipPath, activeXVerticalLine } =
            this

        const comparisonLines = manager.comparisonLines || []

        const showLegend = !manager.hideLegend

        // The tiny bit of extra space in the clippath is to ensure circles centered on the very edge are still fully visible
        return (
            <g
                ref={this.base}
                className="LineChart"
                onMouseLeave={this.onCursorLeave}
                onTouchEnd={this.onCursorLeave}
                onTouchCancel={this.onCursorLeave}
                onMouseMove={this.onCursorMove}
                onTouchStart={this.onCursorMove}
                onTouchMove={this.onCursorMove}
            >
                {clipPath.element}
                <rect {...this.bounds.toProps()} fill="transparent">
                    {/* This <rect> ensures that the parent <g> is big enough such that we get mouse hover events for the
                    whole charting area, including the axis, the entity labels, and the whitespace next to them.
                    We need these to be able to show the tooltip for the first/last year even if the mouse is outside the charting area. */}
                </rect>
                {this.hasColorLegend && (
                    <HorizontalNumericColorLegend manager={this} />
                )}
                <DualAxisComponent dualAxis={dualAxis} showTickMarks={true} />
                <g clipPath={clipPath.id}>
                    {comparisonLines.map((line, index) => (
                        <ComparisonLine
                            key={index}
                            dualAxis={dualAxis}
                            comparisonLine={line}
                        />
                    ))}
                    {showLegend && <LineLegend manager={this} />}
                    <Lines
                        dualAxis={dualAxis}
                        placedSeries={this.placedSeries}
                        hidePoints={manager.hidePoints}
                        focusedSeriesNames={this.focusedSeriesNames}
                        lineStrokeWidth={this.lineStrokeWidth}
                        lineOutlineWidth={this.lineOutlineWidth}
                        markerRadius={this.markerRadius}
                    />
                </g>
                {activeXVerticalLine}

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

    @computed private get colorColumnSlug(): string | undefined {
        return this.manager.colorColumnSlug
    }

    @computed private get colorColumn(): CoreColumn {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    @computed private get formatColumn(): CoreColumn {
        return this.yColumns[0]
    }

    @computed private get hasColorScale(): boolean {
        return !this.colorColumn.isMissing
    }

    // Color scale props

    @computed get colorScaleColumn(): CoreColumn {
        return (
            // For faceted charts, we have to get the values of inputTable before it's filtered by
            // the faceting logic.
            this.manager.colorScaleColumnOverride ??
            // We need to use inputTable in order to get consistent coloring for a variable across
            // charts, e.g. each continent being assigned to the same color.
            // inputTable is unfiltered, so it contains every value that exists in the variable.
            this.inputTable.get(this.colorColumnSlug)
        )
    }

    @computed get colorScaleConfig(): ColorScaleConfigInterface | undefined {
        return (
            ColorScaleConfig.fromDSL(this.colorColumn.def) ??
            this.manager.colorScale
        )
    }

    @computed get hasNoDataBin(): boolean {
        if (!this.hasColorScale) return false
        return this.colorColumn.valuesIncludingErrorValues.some(
            (value) => !isNotErrorValue(value)
        )
    }

    defaultBaseColorScheme = ColorSchemeName.YlGnBu
    defaultNoDataColor = "#959595"
    transformColor = darkenColorForLine
    colorScale = this.props.manager.colorScaleOverride ?? new ColorScale(this)

    private getColorScaleColor(value: CoreValueType | undefined): Color {
        return this.colorScale.getColor(value) ?? DEFAULT_LINE_COLOR
    }

    // End of color scale props

    // Color legend props

    @computed private get hasColorLegend(): boolean {
        return this.hasColorScale && !this.manager.hideLegend
    }

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get legendMaxWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.center
    }

    // TODO just pass colorScale to legend and let it figure it out?
    @computed get numericLegendData(): ColorScaleBin[] {
        // Move CategoricalBins to end
        return sortBy(
            this.colorScale.legendBins,
            (bin) => bin instanceof CategoricalBin
        )
    }

    // TODO just pass colorScale to legend and let it figure it out?
    @computed get equalSizeBins(): boolean | undefined {
        return this.colorScale.config.equalSizeBins
    }

    numericBinSize = 6
    numericBinStroke = BACKGROUND_COLOR
    numericBinStrokeWidth = 1
    legendTextColor = "#555"
    legendTickSize = 1

    @computed get numericLegend(): HorizontalNumericColorLegend | undefined {
        return this.hasColorScale && !this.manager.hideLegend
            ? new HorizontalNumericColorLegend({ manager: this })
            : undefined
    }

    @computed get numericLegendY(): number {
        return this.bounds.top
    }

    @computed get legendTitle(): string | undefined {
        return this.hasColorScale
            ? this.colorScale.legendDescription
            : undefined
    }

    @computed get legendHeight(): number {
        return this.numericLegend?.height ?? 0
    }

    // End of color legend props

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
        return autoDetectSeriesStrategy(this.manager, true)
    }

    @computed get isLogScale(): boolean {
        return this.yAxisConfig.scaleType === ScaleType.log
    }

    @computed private get categoricalColorAssigner(): CategoricalColorAssigner {
        return new CategoricalColorAssigner({
            colorScheme: this.colorScheme,
            invertColorScheme: this.manager.invertColorScheme,
            colorMap:
                this.seriesStrategy === SeriesStrategy.entity
                    ? this.inputTable.entityNameColorIndex
                    : this.inputTable.columnDisplayNameToColorMap,
            autoColorMapCache: this.manager.seriesColorMap,
        })
    }

    private getSeriesName(
        entityName: EntityName,
        columnName: string,
        entityCount: number
    ): SeriesName {
        if (this.seriesStrategy === SeriesStrategy.entity) {
            return entityName
        }
        if (entityCount > 1 || this.manager.canSelectMultipleEntities) {
            return `${entityName} - ${columnName}`
        } else {
            return columnName
        }
    }

    private getColorKey(
        entityName: EntityName,
        columnName: string,
        entityCount: number
    ): SeriesName {
        if (this.seriesStrategy === SeriesStrategy.entity) {
            return entityName
        }
        // If only one entity is plotted, we want to use the column colors.
        // Unlike in `getSeriesName`, we don't care whether the user can select
        // multiple entities, only whether more than one is plotted.
        if (entityCount > 1) {
            return `${entityName} - ${columnName}`
        } else {
            return columnName
        }
    }

    // cache value for performance
    @computed private get rowIndicesByEntityName(): Map<string, number[]> {
        return this.transformedTable.rowIndex([
            this.transformedTable.entityNameSlug,
        ])
    }

    private constructSingleSeries(
        entityName: string,
        col: CoreColumn
    ): LineChartSeries {
        const { hasColorScale, transformedTable, colorColumn } = this

        // Construct the points
        const timeValues = col.originalTimeColumn.valuesIncludingErrorValues
        const values = col.valuesIncludingErrorValues
        const colorValues = colorColumn.valuesIncludingErrorValues
        // If Y and Color are the same column, we need to get rid of any duplicate rows.
        // Duplicates occur because Y doesn't have tolerance applied, but Color does.
        const rowIndexes = sortedUniqBy(
            this.rowIndicesByEntityName
                .get(entityName)!
                .filter((index) => isNumber(values[index])),
            (index) => timeValues[index]
        )
        const points = rowIndexes.map((index) => {
            const point: LinePoint = {
                x: timeValues[index] as number,
                y: values[index] as number,
            }
            if (hasColorScale) {
                const colorValue = colorValues[index]
                point.colorValue = isNotErrorValue(colorValue)
                    ? colorValue
                    : undefined
            }
            return point
        })

        // Construct series properties
        const totalEntityCount = transformedTable.availableEntityNames.length
        const seriesName = this.getSeriesName(
            entityName,
            col.displayName,
            totalEntityCount
        )
        let seriesColor: Color
        if (hasColorScale) {
            const colorValue = last(points)?.colorValue
            seriesColor = this.getColorScaleColor(colorValue)
        } else {
            seriesColor = this.categoricalColorAssigner.assign(
                this.getColorKey(entityName, col.displayName, totalEntityCount)
            )
        }

        return {
            points,
            seriesName,
            isProjection: col.isProjection,
            color: seriesColor,
        }
    }

    @computed get series(): readonly LineChartSeries[] {
        return flatten(
            this.yColumns.map((col) =>
                col.uniqEntityNames.map(
                    (entityName): LineChartSeries =>
                        this.constructSingleSeries(entityName, col)
                )
            )
        )
    }

    // TODO: remove, seems unused
    @computed get allPoints(): LinePoint[] {
        return flatten(this.series.map((series) => series.points))
    }

    @computed get placedSeries(): PlacedLineChartSeries[] {
        const { dualAxis } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        return this.series
            .slice()
            .reverse()
            .map((series) => {
                return {
                    ...series,
                    placedPoints: series.points.map(
                        (point): PlacedPoint => ({
                            x: round(horizontalAxis.place(point.x), 1),
                            y: round(verticalAxis.place(point.y), 1),
                            color: this.hasColorScale
                                ? this.getColorScaleColor(point.colorValue)
                                : series.color,
                        })
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
        return new AxisConfig(
            {
                hideGridlines: true,
                ...this.manager.xAxisConfig,
            },
            this
        )
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const axis = this.xAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(
            this.transformedTable.timeDomainFor(this.yColumnSlugs)
        )
        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.inputTable.timeColumn
        axis.hideFractionalTicks = true
        return axis
    }

    @computed private get yAxisConfig(): AxisConfig {
        // TODO: enable nice axis ticks for linear scales
        return new AxisConfig(
            {
                // if we only have a single y value (probably 0), we want the
                // horizontal axis to be at the bottom of the chart.
                // see https://github.com/owid/owid-grapher/pull/975#issuecomment-890798547
                singleValueAxisPointAlign: AxisAlign.start,
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
            bounds: this.boundsWithoutColorLegend.padRight(
                this.lineLegendDimensions
                    ? this.lineLegendDimensions.width
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

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (this.manager.hideLegend) {
            const numericLegendData = this.hasColorScale
                ? this.numericLegendData
                : []
            const categoricalLegendData = this.hasColorScale
                ? []
                : this.series.map(
                      (series, index) =>
                          new CategoricalBin({
                              index,
                              value: series.seriesName,
                              label: series.seriesName,
                              color: series.color,
                          })
                  )
            return {
                legendTitle: this.legendTitle,
                legendTextColor: this.legendTextColor,
                legendTickSize: this.legendTickSize,
                equalSizeBins: this.equalSizeBins,
                numericBinSize: this.numericBinSize,
                numericBinStroke: this.numericBinStroke,
                numericBinStrokeWidth: this.numericBinStrokeWidth,
                numericLegendData,
                categoricalLegendData,
            }
        }
        return undefined
    }
}
