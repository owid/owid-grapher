import React from "react"
import { select } from "d3-selection"
import {
    min,
    max,
    sortBy,
    exposeInstanceOnWindow,
    uniq,
    Bounds,
    DEFAULT_BOUNDS,
    Time,
    SortOrder,
    SortBy,
    SortConfig,
    Color,
    HorizontalAlign,
    AxisAlign,
    uniqBy,
    makeIdForHumanConsumption,
    dyFromAlign,
} from "@ourworldindata/utils"
import { computed } from "mobx"
import { observer } from "mobx-react"
import {
    ScaleType,
    SeriesStrategy,
    FacetStrategy,
    ColorScaleConfigInterface,
    CoreValueType,
    ColorSchemeName,
    VerticalAlign,
} from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    GRAPHER_AXIS_LINE_WIDTH_THICK,
    GRAPHER_AXIS_LINE_WIDTH_DEFAULT,
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { HorizontalAxisZeroLine } from "../axis/AxisViews"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { ColorSchemes } from "../color/ColorSchemes"
import { ChartInterface } from "../chart/ChartInterface"
import {
    BACKGROUND_COLOR,
    DiscreteBarChartManager,
    DiscreteBarSeries,
    PlacedDiscreteBarSeries,
} from "./DiscreteBarChartConstants"
import {
    OwidTable,
    CoreColumn,
    isNotErrorValue,
} from "@ourworldindata/core-table"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    getShortNameForEntity,
    makeSelectionArray,
} from "../chart/ChartUtils"
import { HorizontalAxis } from "../axis/Axis"
import { SelectionArray } from "../selection/SelectionArray"
import { ColorScheme } from "../color/ColorScheme"
import { ColorScale, ColorScaleManager } from "../color/ColorScale"
import { ColorScaleConfig } from "../color/ColorScaleConfig"
import {
    GRAPHER_DARK_TEXT,
    OWID_ERROR_COLOR,
    OWID_NO_DATA_GRAY,
} from "../color/ColorConstants"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { BaseType, Selection } from "d3"
import { TextWrap } from "@ourworldindata/components"
import {
    HorizontalNumericColorLegend,
    HorizontalNumericColorLegendProps,
} from "../horizontalColorLegend/HorizontalNumericColorLegend"
import { HorizontalNumericColorLegendComponent } from "../horizontalColorLegend/HorizontalNumericColorLegendComponent"

const labelToTextPadding = 10
const labelToBarPadding = 5

const LEGEND_PADDING = 25
const DEFAULT_PROJECTED_DATA_COLOR_IN_LEGEND = "#787878"

// if an entity name exceeds this width, we use the short name instead (if available)
const SOFT_MAX_LABEL_WIDTH = 90

export interface Label {
    valueString: string
    timeString: string
    width: number
}

interface DiscreteBarItem {
    yColumn: CoreColumn
    seriesName: string
    value: number
    time: number
    colorValue?: CoreValueType
    color?: Color
}

@observer
export class DiscreteBarChart
    extends React.Component<{
        bounds?: Bounds
        manager: DiscreteBarChartManager
    }>
    implements ChartInterface, AxisManager, ColorScaleManager
{
    base: React.RefObject<SVGGElement> = React.createRef()

    transformTable(table: OwidTable): OwidTable {
        if (!this.yColumnSlugs.length) return table

        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        if (this.isLogScale)
            table = table.replaceNonPositiveCellsForLogScale(this.yColumnSlugs)

        table = table.dropRowsWithErrorValuesForAllColumns(this.yColumnSlugs)

        this.yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

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

    @computed get transformedTable(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed private get manager(): DiscreteBarChartManager {
        return this.props.manager
    }

    @computed private get targetTime(): Time | undefined {
        return this.manager.endTime
    }

    @computed private get isLogScale(): boolean {
        return this.yAxisConfig.scaleType === ScaleType.log
    }

    @computed private get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_BOUNDS).padRight(10)
    }

    @computed private get boundsWithoutColorLegend(): Bounds {
        return this.bounds.padTop(
            this.showColorLegend ? this.legendHeight + LEGEND_PADDING : 0
        )
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get labelFontSize(): number {
        const availableHeight =
            this.boundsWithoutColorLegend.height / this.barCount
        return Math.min(
            GRAPHER_FONT_SCALE_12 * this.fontSize,
            1.1 * availableHeight
        )
    }

    @computed private get legendLabelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        return {
            fontSize: this.labelFontSize,
            fontWeight: 700,
        }
    }

    @computed private get valueLabelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        return {
            fontSize: this.labelFontSize,
            fontWeight: 400,
        }
    }

    // Account for the width of the legend
    @computed private get seriesLegendWidth(): number {
        return max(this.sizedSeries.map((s) => s.label?.width ?? 0)) ?? 0
    }

    @computed private get hasPositive(): boolean {
        return this.series.some((d) => d.value >= 0)
    }

    @computed private get hasNegative(): boolean {
        return this.series.some((d) => d.value < 0)
    }

    // The amount of space we need to allocate for bar end labels on the right
    @computed private get rightValueLabelWidth(): number {
        if (!this.hasPositive) return 0

        return (
            max(
                this.series
                    .filter((d) => d.value >= 0)
                    .map((d) => this.formatValue(d).width)
            ) ?? 0
        )
    }

    // The amount of space we need to allocate for bar end labels on the left
    // These are only present if there are negative values
    // We pad this a little so it doesn't run directly up against the bar labels themselves
    @computed private get leftValueLabelWidth(): number {
        if (!this.hasNegative) return 0

        const labelAndValueWidths = this.sizedSeries
            .filter((s) => s.value < 0)
            .map((s) => {
                const labelWidth = s.label?.width ?? 0
                const valueWidth = this.formatValue(s).width
                return labelWidth + valueWidth + labelToTextPadding
            })

        return max(labelAndValueWidths) ?? 0
    }

    @computed private get x0(): number {
        if (!this.isLogScale) return 0

        const minValue = min(this.series.map((d) => d.value))
        return minValue !== undefined ? Math.min(1, minValue) : 1
    }

    // Now we can work out the main x axis scale
    @computed private get xDomainDefault(): [number, number] {
        const allValues = this.series.map((d) => d.value)
        return [
            Math.min(this.x0, min(allValues) as number),
            Math.max(this.x0, max(allValues) as number),
        ]
    }

    @computed private get xRange(): [number, number] {
        return [
            this.boundsWithoutColorLegend.left +
                Math.max(this.seriesLegendWidth, this.leftValueLabelWidth),
            this.boundsWithoutColorLegend.right - this.rightValueLabelWidth,
        ]
    }

    // NB: y-axis settings are used for the horizontal axis in DiscreteBarChart
    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                // if we have a single-value x axis, we want to have the vertical axis
                // on the left of the chart
                singleValueAxisPointAlign: AxisAlign.start,
                ...this.manager.yAxisConfig,
            },
            this
        )
    }

    @computed get yAxis(): HorizontalAxis {
        // NB: We use the user's YAxis options here to make the XAxis
        const axis = this.yAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.xDomainDefault)

        axis.formatColumn = this.yColumns[0] // todo: does this work for columns as series?
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed private get innerBounds(): Bounds {
        return this.boundsWithoutColorLegend
            .padLeft(Math.max(this.seriesLegendWidth, this.leftValueLabelWidth))
            .padRight(this.rightValueLabelWidth)
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.selection)
    }

    @computed private get barCount(): number {
        return this.series.length
    }

    @computed private get barHeight(): number {
        return (0.8 * this.innerBounds.height) / this.barCount
    }

    // useful if `this.barHeight` can't be used due to a cyclic dependency
    // keep in mind though that this is not exactly the same as `this.barHeight`
    @computed private get approximateBarHeight(): number {
        return (0.8 * this.boundsWithoutColorLegend.height) / this.barCount
    }

    @computed private get barSpacing(): number {
        return this.innerBounds.height / this.barCount - this.barHeight
    }

    @computed private get barPlacements(): { x: number; width: number }[] {
        const { series, yAxis } = this
        return series.map((d) => {
            const isNegative = d.value < 0
            const barX = isNegative
                ? yAxis.place(d.value)
                : yAxis.place(this.x0)
            const barWidth = isNegative
                ? yAxis.place(this.x0) - barX
                : yAxis.place(d.value) - barX

            return { x: barX, width: barWidth }
        })
    }

    @computed private get barWidths(): number[] {
        return this.barPlacements.map((b) => b.width)
    }

    private d3Bars(): Selection<
        BaseType,
        unknown,
        SVGGElement | null,
        unknown
    > {
        return select(this.base.current).selectAll("g.bar > rect")
    }

    private animateBarWidth(): void {
        this.d3Bars()
            .transition()
            .attr("width", (_, i) => this.barWidths[i])
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        // if we have multi-dimension, multi-entity data (which is necessarily single-year),
        // then *only* faceting makes sense. otherwise, faceting is not useful.
        if (
            this.yColumns.length > 1 &&
            this.selectionArray.numSelectedEntities > 1
        ) {
            // if we have more than one unit, then faceting by entity is not allowed
            // as comparing multiple units in a single chart isn't meaningful
            const uniqueUnits = new Set(
                this.yColumns.map((column) => column.shortUnit)
            )
            if (uniqueUnits.size > 1) {
                return [FacetStrategy.metric]
            }

            return [FacetStrategy.entity, FacetStrategy.metric]
        }

        return [FacetStrategy.none]
    }

    componentDidMount(): void {
        if (!this.manager.disableIntroAnimation) {
            this.d3Bars().attr("width", 0)
            this.animateBarWidth()
        }
        exposeInstanceOnWindow(this)
    }

    componentDidUpdate(): void {
        // Animating the bar width after a render ensures there's no race condition, where the
        // initial animation (in componentDidMount) did override the now-changed bar width in
        // some cases. Updating the animation with the updated bar widths fixes that.
        if (!this.manager.disableIntroAnimation) this.animateBarWidth()
    }

    renderEntityLabels(): React.ReactElement {
        const style = { fill: "#555", textAnchor: "end" }
        return (
            <g id={makeIdForHumanConsumption("entity-labels")}>
                {this.placedSeries.map((series) => {
                    return (
                        series.label && (
                            <React.Fragment key={series.seriesName}>
                                {series.label.render(
                                    series.entityLabelX,
                                    series.barY - series.label.height / 2,
                                    { textProps: style }
                                )}
                            </React.Fragment>
                        )
                    )
                })}
            </g>
        )
    }

    renderValueLabels(): React.ReactElement {
        return (
            <g id={makeIdForHumanConsumption("value-labels")}>
                {this.placedSeries.map((series) => {
                    const formattedLabel = this.formatValue(series)
                    return (
                        <text
                            key={series.seriesName}
                            x={0}
                            y={0}
                            transform={`translate(${series.valueLabelX}, ${series.barY})`}
                            fill={GRAPHER_DARK_TEXT}
                            dy={dyFromAlign(VerticalAlign.middle)}
                            textAnchor={series.value < 0 ? "end" : "start"}
                            {...this.valueLabelStyle}
                        >
                            {formattedLabel.valueString}
                            <tspan fill="#999">
                                {formattedLabel.timeString}
                            </tspan>
                        </text>
                    )
                })}
            </g>
        )
    }

    renderBars(): React.ReactElement {
        return (
            <g id={makeIdForHumanConsumption("bars")}>
                {this.placedSeries.map((series) => {
                    const barColor = series.yColumn.isProjection
                        ? `url(#${makeProjectedDataPatternId(series.color)})`
                        : series.color

                    // Using transforms for positioning to enable better (subpixel) transitions
                    // Width transitions don't work well on iOS Safari – they get interrupted and
                    // it appears very slow. Also be careful with negative bar charts.
                    return (
                        <rect
                            id={makeIdForHumanConsumption(series.seriesName)}
                            key={series.seriesName}
                            x={0}
                            y={0}
                            transform={`translate(${series.barX}, ${series.barY - this.barHeight / 2})`}
                            width={series.barWidth}
                            height={this.barHeight}
                            fill={barColor}
                            opacity={GRAPHER_AREA_OPACITY_DEFAULT}
                            style={{ transition: "height 200ms ease" }}
                        />
                    )
                })}
            </g>
        )
    }

    renderDefs(): React.ReactElement | void {
        const projections = this.series.filter(
            (series) => series.yColumn.isProjection
        )
        const uniqProjections = uniqBy(projections, (series) => series.color)
        if (projections.length === 0) return

        return (
            <defs>
                {/* passed to the legend as pattern for the projected data legend item */}
                {makeProjectedDataPattern(this.projectedDataColorInLegend)}
                {/* make a pattern for every series with a unique color */}
                {uniqProjections.map((series) =>
                    makeProjectedDataPattern(series.color)
                )}
            </defs>
        )
    }

    renderChartArea(): React.ReactElement {
        const { manager, yAxis, innerBounds } = this

        const axisLineWidth = manager.isStaticAndSmall
            ? 0.5 * GRAPHER_AXIS_LINE_WIDTH_THICK
            : 0.5 * GRAPHER_AXIS_LINE_WIDTH_DEFAULT

        return (
            <>
                {this.renderDefs()}
                {this.showColorLegend && (
                    <HorizontalNumericColorLegendComponent
                        legend={this.legend}
                    />
                )}
                {!this.isLogScale && (
                    <HorizontalAxisZeroLine
                        horizontalAxis={yAxis}
                        bounds={innerBounds}
                        strokeWidth={axisLineWidth}
                        // if the chart doesn't have negative values, then we
                        // move the zero line a little to the left to avoid
                        // overlap with the bars
                        align={
                            this.hasNegative
                                ? HorizontalAlign.center
                                : HorizontalAlign.right
                        }
                    />
                )}
                {this.renderBars()}
                {this.renderValueLabels()}
                {this.renderEntityLabels()}
            </>
        )
    }

    render(): React.ReactElement {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        return this.manager.isStatic ? (
            this.renderChartArea()
        ) : (
            <g
                ref={this.base}
                id={makeIdForHumanConsumption("discrete-bar-chart")}
                className="DiscreteBarChart"
            >
                {this.renderChartArea()}
            </g>
        )
    }

    @computed get failMessage(): string {
        const column = this.yColumns[0]

        if (!column) return "No column to chart"

        if (!this.selectionArray.hasSelection) return `No data selected`

        // TODO is it better to use .series for this check?
        return this.yColumns.every((col) => col.isEmpty)
            ? "No matching data"
            : ""
    }

    formatValue(series: DiscreteBarSeries): Label {
        const { transformedTable } = this
        const { yColumn } = series

        const showYearLabels =
            this.manager.showYearLabels || series.time !== this.targetTime
        const valueString = yColumn.formatValueShort(series.value)
        let timeString = ""
        if (showYearLabels) {
            const { timeColumn } = transformedTable
            const preposition = OwidTable.getPreposition(timeColumn)
            timeString = ` ${preposition} ${timeColumn.formatTime(series.time)}`
        }

        const labelBounds = Bounds.forText(
            valueString + timeString,
            this.valueLabelStyle
        )

        return {
            valueString,
            timeString,
            width: labelBounds.width,
        }
    }

    @computed private get yColumnSlugs(): string[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed private get colorColumnSlug(): string | undefined {
        return this.manager.colorColumnSlug
    }

    @computed private get colorColumn(): CoreColumn {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    @computed get seriesStrategy(): SeriesStrategy {
        const autoStrategy = autoDetectSeriesStrategy(this.manager, true)
        // TODO this is an inconsistency between LineChart and DiscreteBar.
        // We should probably make it consistent at some point.
        if (
            autoStrategy === SeriesStrategy.column &&
            this.selectionArray.numSelectedEntities > 1
        ) {
            return SeriesStrategy.entity
        }
        if (
            autoStrategy === SeriesStrategy.entity &&
            this.selectionArray.numSelectedEntities === 1 &&
            this.yColumns.length > 1
        ) {
            return SeriesStrategy.column
        }
        return autoStrategy
    }

    @computed protected get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed get hasProjectedData(): boolean {
        return this.series.some((series) => series.yColumn.isProjection)
    }

    constructSeries(col: CoreColumn, indexes: number[]): DiscreteBarItem[] {
        const { transformedTable, colorColumn, hasColorScale } = this
        const values = col.valuesIncludingErrorValues
        const originalTimes = col.originalTimeColumn.valuesIncludingErrorValues
        const entityNames =
            transformedTable.entityNameColumn.valuesIncludingErrorValues
        const colorValues = colorColumn.valuesIncludingErrorValues
        return indexes.map((index): DiscreteBarItem => {
            const isColumnStrategy =
                this.seriesStrategy === SeriesStrategy.column
            const seriesName = isColumnStrategy
                ? col.displayName
                : (entityNames[index] as string)
            const colorValue = isNotErrorValue(colorValues[index])
                ? colorValues[index]
                : undefined
            const color = hasColorScale
                ? this.colorScale.getColor(colorValue)
                : isColumnStrategy
                  ? col.def.color
                  : transformedTable.getColorForEntityName(
                        entityNames[index] as string
                    )
            return {
                yColumn: col,
                seriesName,
                value: values[index] as number,
                time: originalTimes[index] as number,
                colorValue,
                color,
            }
        })
    }

    @computed private get columnsAsSeries(): DiscreteBarItem[] {
        return this.yColumns.flatMap((col) =>
            this.constructSeries(col, col.validRowIndices.slice(0, 1))
        )
    }

    @computed private get entitiesAsSeries(): DiscreteBarItem[] {
        const col = this.yColumns[0]
        return this.constructSeries(col, col.validRowIndices)
    }

    @computed get sortConfig(): SortConfig {
        return this.manager.sortConfig ?? {}
    }

    @computed private get sortedRawSeries(): DiscreteBarItem[] {
        const raw =
            this.seriesStrategy === SeriesStrategy.entity
                ? this.entitiesAsSeries
                : this.columnsAsSeries

        let sortByFunc: (item: DiscreteBarItem) => number | string | undefined
        switch (this.sortConfig.sortBy) {
            case SortBy.custom:
                if (this.seriesStrategy === SeriesStrategy.entity) {
                    sortByFunc = (item: DiscreteBarItem): number =>
                        this.selectionArray.selectedEntityNames.indexOf(
                            item.seriesName
                        )
                } else {
                    sortByFunc = (): undefined => undefined
                }
                break
            case SortBy.entityName:
                sortByFunc = (item: DiscreteBarItem): string => item.seriesName
                break
            default:
            case SortBy.total:
            case SortBy.column: // we only have one yColumn, so total and column are the same
                sortByFunc = (item: DiscreteBarItem): number => item.value
                break
        }
        const sortedSeries = sortBy(raw, sortByFunc)
        const sortOrder = this.sortConfig.sortOrder ?? SortOrder.desc
        if (sortOrder === SortOrder.desc) sortedSeries.reverse()
        return sortedSeries
    }

    @computed private get colorScheme(): ColorScheme {
        // We used to choose owid-distinct here as the default if this is a collapsed line chart but
        // as part of the color revamp in Autumn 2022 we decided to make bar charts always default to
        // an all-blue color scheme (singleColorDenim).
        const defaultColorScheme = this.defaultBaseColorScheme
        const colorScheme = this.manager.baseColorScheme ?? defaultColorScheme
        return this.manager.isOnLineChartTab
            ? ColorSchemes.get(defaultColorScheme)
            : ColorSchemes.get(colorScheme)
    }

    @computed private get valuesToColorsMap(): Map<number, string> {
        const { manager, colorScheme, sortedRawSeries } = this

        return colorScheme.getUniqValueColorMap(
            uniq(sortedRawSeries.map((series) => series.value)),
            !manager.invertColorScheme // negate here to be consistent with how things worked before
        )
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

    defaultBaseColorScheme = ColorSchemeName.SingleColorDenim
    defaultNoDataColor = OWID_NO_DATA_GRAY
    colorScale = this.props.manager.colorScaleOverride ?? new ColorScale(this)

    // End of color scale props

    // Color legend props

    @computed get hasColorLegend(): boolean {
        return this.hasColorScale || this.hasProjectedData
    }

    @computed get showColorLegend(): boolean {
        return this.hasColorLegend && !!this.manager.showLegend
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
        const legendBins = this.colorScale.legendBins.slice()

        // Show a "Projected data" legend item with a striped pattern if appropriate
        if (this.hasProjectedData) {
            legendBins.push(
                new CategoricalBin({
                    color: this.projectedDataColorInLegend,
                    label: "Projected data",
                    index: 0,
                    value: "projected",
                    patternRef: makeProjectedDataPatternId(
                        this.projectedDataColorInLegend
                    ),
                })
            )
        }

        // Move CategoricalBins to end
        return sortBy(legendBins, (bin) => bin instanceof CategoricalBin)
    }

    @computed
    private get legendProps(): HorizontalNumericColorLegendProps {
        return {
            fontSize: this.fontSize,
            x: this.legendX,
            align: this.legendAlign,
            maxWidth: this.legendMaxWidth,
            numericLegendData: this.numericLegendData,
            numericBinSize: this.numericBinSize,
            numericBinStroke: this.numericBinStroke,
            equalSizeBins: this.equalSizeBins,
            legendTitle: this.legendTitle,
            numericLegendY: this.numericLegendY,
            legendTextColor: this.legendTextColor,
            legendTickSize: this.legendTickSize,
        }
    }

    @computed private get legend(): HorizontalNumericColorLegend {
        return new HorizontalNumericColorLegend(this.legendProps)
    }

    @computed get projectedDataColorInLegend(): string {
        // if a single color is in use, use that color in the legend
        if (uniqBy(this.series, "color").length === 1)
            return this.series[0].color
        return DEFAULT_PROJECTED_DATA_COLOR_IN_LEGEND
    }

    @computed get externalNumericLegend():
        | HorizontalNumericColorLegendProps
        | undefined {
        if (this.hasColorLegend) {
            return {
                numericLegendData: this.numericLegendData,
            }
        }
        return undefined
    }

    // TODO just pass colorScale to legend and let it figure it out?
    @computed get equalSizeBins(): boolean | undefined {
        return this.colorScale.config.equalSizeBins
    }

    numericBinSize = 10
    numericBinStroke = BACKGROUND_COLOR
    numericBinStrokeWidth = 1
    legendTextColor = "#555"
    legendTickSize = 1

    @computed get legendHeight(): number {
        return this.hasColorScale && this.manager.showLegend
            ? HorizontalNumericColorLegend.height(this.legendProps)
            : 0
    }

    @computed get numericLegendY(): number {
        return this.bounds.top
    }

    @computed get legendTitle(): string | undefined {
        return this.hasColorScale
            ? this.colorScale.legendDescription
            : undefined
    }

    // End of color legend props

    @computed get series(): DiscreteBarSeries[] {
        const series = this.sortedRawSeries.map((rawSeries) => {
            const { value, time, colorValue, seriesName, color, yColumn } =
                rawSeries
            const series: DiscreteBarSeries = {
                yColumn,
                value,
                time,
                colorValue,
                seriesName,
                entityName: seriesName,
                shortEntityName: getShortNameForEntity(seriesName),
                // the error color should never be used but I prefer it here instead of throwing an exception if something goes wrong
                color:
                    color ??
                    this.valuesToColorsMap.get(value) ??
                    OWID_ERROR_COLOR,
            }
            return series
        })

        return series
    }

    @computed get sizedSeries(): DiscreteBarSeries[] {
        // can't use `this.barHeight` due to a circular dependency
        const barHeight = this.approximateBarHeight

        return this.series.map((series) => {
            // make sure we're dealing with a single-line text fragment
            const entityName = series.entityName.replace(/\n/g, " ").trim()

            const maxLegendWidth = 0.3 * this.boundsWithoutColorLegend.width

            let label = new TextWrap({
                text: entityName,
                maxWidth: maxLegendWidth,
                ...this.legendLabelStyle,
            })

            // prevent labels from being taller than the bar
            let step = 0
            while (
                label.height > barHeight &&
                label.lines.length > 1 &&
                step < 10 // safety net
            ) {
                label = new TextWrap({
                    text: entityName,
                    maxWidth: label.maxWidth + 20,
                    ...this.legendLabelStyle,
                })
                step += 1
            }

            // if the label is too long, use the short name instead
            const tooLong =
                label.width > SOFT_MAX_LABEL_WIDTH ||
                label.width > maxLegendWidth
            if (tooLong && series.shortEntityName) {
                label = new TextWrap({
                    text: series.shortEntityName,
                    maxWidth: label.maxWidth,
                    ...this.legendLabelStyle,
                })
            }

            return { ...series, label }
        })
    }

    @computed get placedSeries(): PlacedDiscreteBarSeries[] {
        const yOffset =
            this.innerBounds.top + this.barHeight / 2 + this.barSpacing / 2
        return this.sizedSeries.map((series, index) => {
            const barY = yOffset + index * (this.barHeight + this.barSpacing)
            const isNegative = series.value < 0
            const barX = isNegative
                ? this.yAxis.place(series.value)
                : this.yAxis.place(this.x0)
            const barWidth = isNegative
                ? this.yAxis.place(this.x0) - barX
                : this.yAxis.place(series.value) - barX
            const label = this.formatValue(series)
            const entityLabelX = isNegative
                ? barX - label.width - labelToTextPadding
                : barX - labelToBarPadding
            const valueLabelX =
                this.yAxis.place(series.value) +
                (isNegative ? -labelToBarPadding : labelToBarPadding)

            return {
                ...series,
                barX,
                barY,
                barWidth,
                entityLabelX,
                valueLabelX,
            }
        })
    }
}

// Pattern IDs should be unique per document (!), not just per grapher instance.
// Including the color in the id guarantees that the pattern uses the correct color,
// even if it gets resolved to a striped pattern of a different grapher instance.
function makeProjectedDataPatternId(color: string): string {
    return `DiscreteBarChart_stripes_${color}`
}

function makeProjectedDataPattern(color: string): React.ReactElement {
    const size = 7
    return (
        <pattern
            key={color}
            id={makeProjectedDataPatternId(color)}
            patternUnits="userSpaceOnUse"
            width={size}
            height={size}
            patternTransform="rotate(45)"
        >
            {/* transparent background */}
            <rect width={size} height={size} fill={color} opacity={0.5} />
            {/* stripes */}
            <line
                x1="0"
                y="0"
                x2="0"
                y2={size}
                stroke={color}
                strokeWidth="10"
            />
        </pattern>
    )
}
