import React from "react"
import { select } from "d3-selection"
import {
    min,
    max,
    maxBy,
    sortBy,
    exposeInstanceOnWindow,
    uniq,
    flatten,
} from "../../clientUtils/Util.js"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds.js"
import {
    ScaleType,
    BASE_FONT_SIZE,
    SeriesStrategy,
} from "../core/GrapherConstants.js"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
} from "../axis/AxisViews.js"
import { NoDataModal } from "../noDataModal/NoDataModal.js"
import { AxisConfig, FontSizeManager } from "../axis/AxisConfig.js"
import { ColorSchemes } from "../color/ColorSchemes.js"
import { ChartInterface } from "../chart/ChartInterface.js"
import {
    BACKGROUND_COLOR,
    DEFAULT_BAR_COLOR,
    DiscreteBarChartManager,
    DiscreteBarSeries,
} from "./DiscreteBarChartConstants.js"
import { OwidTable } from "../../coreTable/OwidTable.js"
import {
    autoDetectSeriesStrategy,
    autoDetectYColumnSlugs,
    makeSelectionArray,
} from "../chart/ChartUtils.js"
import { HorizontalAxis } from "../axis/Axis.js"
import { SelectionArray } from "../selection/SelectionArray.js"
import { CoreColumn } from "../../coreTable/CoreTableColumns.js"
import { ColorScheme } from "../color/ColorScheme.js"
import {
    Time,
    SortOrder,
    SortBy,
    SortConfig,
    Color,
    HorizontalAlign,
} from "../../clientUtils/owidTypes.js"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner.js"
import { ColorScale, ColorScaleManager } from "../color/ColorScale.js"
import {
    ColorScaleConfig,
    ColorScaleConfigInterface,
} from "../color/ColorScaleConfig.js"
import { ColorSchemeName } from "../color/ColorConstants.js"
import { darkenColorForLine } from "../color/ColorUtils.js"
import { CoreValueType } from "../../coreTable/CoreTableConstants.js"
import { isNotErrorValue } from "../../coreTable/ErrorValues.js"
import {
    CategoricalBin,
    ColorScaleBin,
    NumericBin,
} from "../color/ColorScaleBin.js"
import { HorizontalNumericColorLegend } from "../horizontalColorLegend/HorizontalColorLegends.js"

const labelToTextPadding = 10
const labelToBarPadding = 5

const LEGEND_PADDING = 25

export interface Label {
    valueString: string
    timeString: string
}

interface DiscreteBarItem {
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
    implements ChartInterface, FontSizeManager, ColorScaleManager
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
            this.hasColorLegend ? this.legendHeight + LEGEND_PADDING : 0
        )
    }

    @computed get fontSize(): number {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed private get legendLabelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        const availableHeight = this.boundsWithoutColorLegend.height / this.barCount
        return {
            fontSize: Math.min(0.75 * this.fontSize, 1.1 * availableHeight),
            fontWeight: 700,
        }
    }

    @computed private get valueLabelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        const availableHeight = this.boundsWithoutColorLegend.height / this.barCount
        return {
            fontSize: Math.min(0.75 * this.fontSize, 1.1 * availableHeight),
            fontWeight: 400,
        }
    }

    // Account for the width of the legend
    @computed private get seriesLegendWidth(): number {
        const labels = this.series.map((series) => series.seriesName)
        const longestLabel = maxBy(labels, (d) => d.length)
        return Bounds.forText(longestLabel, this.legendLabelStyle).width
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

        const positiveLabels = this.series
            .filter((d) => d.value >= 0)
            .map(
                (d) =>
                    this.formatValue(d).valueString +
                    this.formatValue(d).timeString
            )
        const longestPositiveLabel = maxBy(positiveLabels, (l) => l.length)
        return Bounds.forText(longestPositiveLabel, this.valueLabelStyle).width
    }

    // The amount of space we need to allocate for bar end labels on the left
    // These are only present if there are negative values
    // We pad this a little so it doesn't run directly up against the bar labels themselves
    @computed private get leftValueLabelWidth(): number {
        if (!this.hasNegative) return 0

        const negativeLabels = this.series
            .filter((d) => d.value < 0)
            .map(
                (d) =>
                    this.formatValue(d).valueString +
                    this.formatValue(d).timeString
            )
        const longestNegativeLabel = maxBy(negativeLabels, (l) => l.length)
        return (
            Bounds.forText(longestNegativeLabel, this.valueLabelStyle).width +
            labelToTextPadding
        )
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
                this.seriesLegendWidth +
                this.leftValueLabelWidth,
            this.boundsWithoutColorLegend.right - this.rightValueLabelWidth,
        ]
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
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
            .padLeft(this.seriesLegendWidth + this.leftValueLabelWidth)
            .padBottom(this.yAxis.height)
            .padRight(this.rightValueLabelWidth)
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    // Leave space for extra bar at bottom to show "Add country" button
    @computed private get barCount(): number {
        return this.series.length
    }

    @computed private get barHeight(): number {
        return (0.8 * this.innerBounds.height) / this.barCount
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

    private d3Bars() {
        return select(this.base.current).selectAll("g.bar > rect")
    }

    private animateBarWidth(): void {
        this.d3Bars()
            .transition()
            .attr("width", (_, i) => this.barWidths[i])
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

    render(): JSX.Element {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const {
            series,
            boundsWithoutColorLegend,
            yAxis,
            innerBounds,
            barHeight,
            barSpacing,
        } = this

        let yOffset = innerBounds.top + barHeight / 2

        return (
            <g ref={this.base} className="DiscreteBarChart">
                <rect
                    x={boundsWithoutColorLegend.left}
                    y={boundsWithoutColorLegend.top}
                    width={boundsWithoutColorLegend.width}
                    height={boundsWithoutColorLegend.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                {this.hasColorLegend && (
                    <HorizontalNumericColorLegend manager={this} />
                )}
                <HorizontalAxisComponent
                    bounds={boundsWithoutColorLegend}
                    axis={yAxis}
                    preferredAxisPosition={innerBounds.bottom}
                />
                <HorizontalAxisGridLines
                    horizontalAxis={yAxis}
                    bounds={innerBounds}
                />
                {series.map((series) => {
                    // Todo: add a "placedSeries" getter to get the transformed series, then just loop over the placedSeries and render a bar for each
                    const isNegative = series.value < 0
                    const barX = isNegative
                        ? yAxis.place(series.value)
                        : yAxis.place(this.x0)
                    const barWidth = isNegative
                        ? yAxis.place(this.x0) - barX
                        : yAxis.place(series.value) - barX
                    const barColor = series.color
                    const label = this.formatValue(series)
                    const labelX = isNegative
                        ? barX -
                          Bounds.forText(
                              label.valueString,
                              this.valueLabelStyle
                          ).width -
                          labelToTextPadding
                        : barX - labelToBarPadding

                    // Using transforms for positioning to enable better (subpixel) transitions
                    // Width transitions don't work well on iOS Safari – they get interrupted and
                    // it appears very slow. Also be careful with negative bar charts.
                    const result = (
                        <g
                            key={series.seriesName}
                            className="bar"
                            transform={`translate(0, ${yOffset})`}
                        >
                            <text
                                x={0}
                                y={0}
                                transform={`translate(${labelX}, 0)`}
                                fill="#555"
                                dominantBaseline="middle"
                                textAnchor="end"
                                {...this.legendLabelStyle}
                            >
                                {series.seriesName}
                            </text>
                            <rect
                                x={0}
                                y={0}
                                transform={`translate(${barX}, ${
                                    -barHeight / 2
                                })`}
                                width={barWidth}
                                height={barHeight}
                                fill={barColor}
                                opacity={0.85}
                                style={{ transition: "height 200ms ease" }}
                            />
                            <text
                                x={0}
                                y={0}
                                transform={`translate(${
                                    yAxis.place(series.value) +
                                    (isNegative
                                        ? -labelToBarPadding
                                        : labelToBarPadding)
                                }, 0)`}
                                fill="#666"
                                dominantBaseline="middle"
                                textAnchor={isNegative ? "end" : "start"}
                                {...this.valueLabelStyle}
                            >
                                {label.valueString}
                                <tspan fill="#999">{label.timeString}</tspan>
                            </text>
                        </g>
                    )

                    yOffset += barHeight + barSpacing

                    return result
                })}
            </g>
        )
    }

    @computed get failMessage(): string {
        const column = this.yColumns[0]

        if (!column) return "No column to chart"

        if (!this.selectionArray.hasSelection) return `No data selected`

        // TODO is it better to use .series for this check?
        return this.yColumns.every((col) => col.isEmpty)
            ? `No matching data in columns ${this.yColumnSlugs.join(", ")}`
            : ""
    }

    formatValue(series: DiscreteBarSeries): Label {
        const column = this.yColumns[0] // todo: do we need to use the right column here?
        const { transformedTable } = this

        const showYearLabels =
            this.manager.showYearLabels || series.time !== this.targetTime
        const displayValue = column.formatValueShort(series.value)
        const { timeColumn } = transformedTable
        const preposition = OwidTable.getPreposition(timeColumn)

        return {
            valueString: displayValue,
            timeString: showYearLabels
                ? ` ${preposition} ${transformedTable.timeColumnFormatFunction(
                      series.time
                  )}`
                : "",
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

    @computed private get seriesStrategy(): SeriesStrategy {
        const autoStrategy = autoDetectSeriesStrategy(this.manager, true)
        // TODO this is an inconsistency between LineChart and DiscreteBar.
        // We should probably make it consistent at some point.
        if (
            autoStrategy === SeriesStrategy.column &&
            this.selectionArray.numSelectedEntities > 1
        ) {
            return SeriesStrategy.entity
        }
        return autoStrategy
    }

    @computed protected get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
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
                seriesName,
                value: values[index] as number,
                time: originalTimes[index] as number,
                colorValue,
                color,
            }
        })
    }

    @computed private get columnsAsSeries(): DiscreteBarItem[] {
        return flatten(
            this.yColumns.map((col) =>
                this.constructSeries(col, col.validRowIndices.slice(0, 1))
            )
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
                sortByFunc = () => undefined
                break
            case SortBy.entityName:
                sortByFunc = (item: DiscreteBarItem) => item.seriesName
                break
            default:
            case SortBy.total:
            case SortBy.column: // we only have one yColumn, so total and column are the same
                sortByFunc = (item: DiscreteBarItem) => item.value
                break
        }
        const sortedSeries = sortBy(raw, sortByFunc)
        const sortOrder = this.sortConfig.sortOrder ?? SortOrder.desc
        if (sortOrder === SortOrder.desc) sortedSeries.reverse()
        return sortedSeries
    }

    @computed private get colorScheme(): ColorScheme | undefined {
        // If this DiscreteBarChart stems from a LineChart, we want to match its (default) color
        // scheme OWID Distinct. Otherwise, use an all-blue color scheme (`undefined`) as default.
        const defaultColorScheme = this.manager.isLineChart
            ? ColorSchemes["owid-distinct"]
            : undefined

        return (
            (this.manager.baseColorScheme
                ? ColorSchemes[this.manager.baseColorScheme]
                : undefined) ?? defaultColorScheme
        )
    }

    @computed private get valuesToColorsMap(): Map<number, string> | undefined {
        const { manager, colorScheme, sortedRawSeries } = this

        return colorScheme?.getUniqValueColorMap(
            uniq(sortedRawSeries.map((series) => series.value)),
            !manager.invertColorScheme // negate here to be consistent with how things worked before
        )
    }

    // Only used if it's a LineChart turned into DiscreteBar due to single-point timeline
    @computed private get categoricalColorAssigner():
        | CategoricalColorAssigner
        | undefined {
        if (!this.colorScheme) return undefined
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

    // End of color scale props

    // Color legend props

    @computed get hasColorLegend(): boolean {
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

    numericBinSize = 10
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

    @computed get series(): DiscreteBarSeries[] {
        const { manager } = this

        const series = this.sortedRawSeries.map((rawSeries) => {
            const { value, time, colorValue, seriesName, color } = rawSeries
            const series: DiscreteBarSeries = {
                value,
                time,
                colorValue,
                seriesName,
                color:
                    color ??
                    this.valuesToColorsMap?.get(value) ??
                    DEFAULT_BAR_COLOR,
            }
            return series
        })

        if (
            manager.isLineChart &&
            !this.hasColorScale &&
            this.categoricalColorAssigner
        ) {
            // For LineChart-based bar charts, we want to assign colors from the color scheme.
            // This way we get consistent between the DiscreteBarChart and the LineChart (by using the same logic).
            series.forEach((s) => {
                s.color = this.categoricalColorAssigner!.assign(s.seriesName)
            })
        }
        return series
    }
}
