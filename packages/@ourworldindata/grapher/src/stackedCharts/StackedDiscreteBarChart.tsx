import React from "react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    min,
    max,
    maxBy,
    last,
    flatten,
    excludeUndefined,
    sortBy,
    numberMagnitude,
    first,
    Color,
    SortOrder,
    Time,
    SortBy,
    SortConfig,
    HorizontalAlign,
    getRelativeMouse,
} from "@ourworldindata/utils"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import {
    BASE_FONT_SIZE,
    FacetStrategy,
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_AXIS_LINE_WIDTH_DEFAULT,
    GRAPHER_AXIS_LINE_WIDTH_THICK,
    SeriesName,
} from "../core/GrapherConstants"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
    HorizontalAxisZeroLine,
} from "../axis/AxisViews"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { AxisConfig } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import { OwidTable, EntityName, CoreColumn } from "@ourworldindata/core-table"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"
import {
    stackSeries,
    withMissingValuesAsZeroes,
} from "../stackedCharts/StackedUtils"
import { ChartManager } from "../chart/ChartManager"
import { Tooltip, TooltipState, TooltipTable } from "../tooltip/Tooltip"
import { StackedPoint, StackedSeries } from "./StackedConstants"
import { ColorSchemes } from "../color/ColorSchemes"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { isDarkColor } from "../color/ColorUtils"
import { HorizontalAxis } from "../axis/Axis"
import { SelectionArray } from "../selection/SelectionArray"
import { ColorScheme } from "../color/ColorScheme"
import { HashMap, NodeGroup } from "react-move"
import { easeQuadOut } from "d3-ease"
import { bind } from "decko"
import { CategoricalColorAssigner } from "../color/CategoricalColorAssigner.js"
import { getElementWithHalo } from "../scatterCharts/Halos.js"

const labelToBarPadding = 5

export interface StackedDiscreteBarChartManager extends ChartManager {
    endTime?: Time
    hideTotalValueLabel?: boolean
}

interface Item {
    label: string
    bars: Bar[]
    totalValue: number
}

interface PlacedItem extends Item {
    yPosition: number
}

interface Bar {
    color: Color
    seriesName: string
    columnSlug: string
    point: StackedPoint<EntityName>
}

interface StackedBarChartContext {
    yAxis: HorizontalAxis
    targetTime?: number
    timeColumn: CoreColumn
    formatColumn: CoreColumn
    formatValueForLabel: (value: number) => string
    focusSeriesName?: string
    hoverSeriesName?: string
    hoverEntityName?: string
    barHeight: number
    x0: number
    baseFontSize: number
}

@observer
export class StackedDiscreteBarChart
    extends React.Component<{
        bounds?: Bounds
        manager: StackedDiscreteBarChartManager
        containerElement?: HTMLDivElement
    }>
    implements ChartInterface, HorizontalColorLegendManager
{
    base: React.RefObject<SVGGElement> = React.createRef()

    transformTable(table: OwidTable): OwidTable {
        if (!this.yColumnSlugs.length) return table

        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )

        // TODO: remove this filter once we don't have mixed type columns in datasets
        table = table.replaceNonNumericCellsWithErrorValues(this.yColumnSlugs)

        table = table.dropRowsWithErrorValuesForAllColumns(this.yColumnSlugs)

        this.yColumnSlugs.forEach((slug) => {
            table = table.interpolateColumnWithTolerance(slug)
        })

        if (this.manager.isRelativeMode) {
            table = table.toPercentageFromEachColumnForEachEntityAndTime(
                this.yColumnSlugs
            )
        }

        return table
    }

    @computed get sortConfig(): SortConfig {
        return this.manager.sortConfig ?? {}
    }

    @observable focusSeriesName?: SeriesName

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTable(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed private get manager(): StackedDiscreteBarChartManager {
        return this.props.manager
    }

    @computed private get bounds(): Bounds {
        // bottom padding avoids axis labels to be cut off at some resolutions
        return (this.props.bounds ?? DEFAULT_BOUNDS).padRight(10).padBottom(2)
    }

    @computed private get baseFontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get showLegend(): boolean {
        return !this.manager.hideLegend
    }

    @computed private get boundsWithoutLegend(): Bounds {
        return this.bounds.padTop(
            this.showLegend && this.legend.height > 0
                ? this.legend.height + this.legendPaddingTop
                : 0
        )
    }

    @computed private get labelFontSize(): number {
        // can't use the computed property `barHeight` here as that would create a circular dependency
        const barHeight =
            (0.8 * this.boundsWithoutLegend.height) / this.items.length
        return Math.min(0.75 * this.fontSize, 1.1 * barHeight)
    }

    @computed private get labelStyle(): {
        fontSize: number
        fontWeight: number
    } {
        return {
            fontSize: this.labelFontSize,
            fontWeight: 700,
        }
    }

    @computed private get totalValueLabelStyle(): {
        fill: string
        fontSize: number
    } {
        return {
            fill: "#555",
            fontSize: this.labelFontSize,
        }
    }

    // Account for the width of the legend
    @computed private get labelWidth(): number {
        const labels = this.items.map((item) => item.label)
        const longestLabel = maxBy(labels, (d) => d.length)
        return Bounds.forText(longestLabel, this.labelStyle).width
    }

    @computed get showTotalValueLabel(): boolean {
        return !this.manager.isRelativeMode && !this.manager.hideTotalValueLabel
    }

    @computed get showHorizontalAxis(): boolean {
        return !this.showTotalValueLabel
    }

    // The amount of space we need to allocate for total value labels on the right
    @computed private get totalValueLabelWidth(): number {
        if (!this.showTotalValueLabel) return 0

        const labels = this.items.map((d) =>
            this.formatValueForLabel(d.totalValue)
        )
        const longestLabel = maxBy(labels, (l) => l.length)
        return Bounds.forText(longestLabel, this.totalValueLabelStyle).width
    }

    @computed private get x0(): number {
        return 0
    }

    @computed private get allPoints(): StackedPoint<EntityName>[] {
        return flatten(this.series.map((series) => series.points))
    }

    // Now we can work out the main x axis scale
    @computed private get xDomainDefault(): [number, number] {
        const maxValues = this.allPoints.map(
            (point) => point.value + point.valueOffset
        )
        return [
            Math.min(this.x0, min(maxValues) as number),
            Math.max(this.x0, max(maxValues) as number),
        ]
    }

    @computed private get xRange(): [number, number] {
        return [
            this.bounds.left + this.labelWidth,
            this.bounds.right - this.totalValueLabelWidth,
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
        return this.bounds
            .padLeft(this.labelWidth)
            .padBottom(this.showHorizontalAxis ? this.yAxis.height : 0)
            .padTop(
                this.showLegend && this.legend.height > 0
                    ? this.legend.height + this.legendPaddingTop
                    : 0
            )
            .padRight(this.totalValueLabelWidth)
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    @computed private get items(): readonly Item[] {
        const entityNames = this.selectionArray.selectedEntityNames
        const items = entityNames
            .map((entityName) => {
                let totalValue = 0
                const bars = excludeUndefined(
                    this.series.map((series) => {
                        const point = series.points.find(
                            (point) => point.position === entityName
                        )
                        if (!point) return undefined
                        totalValue += point.value
                        return {
                            point,
                            columnSlug: series.columnSlug!,
                            color: series.color,
                            seriesName: series.seriesName,
                        }
                    })
                )

                return {
                    label: entityName,
                    bars,
                    totalValue,
                }
            })
            .filter((item) => item.bars.length)

        return items
    }

    @computed get sortedItems(): readonly Item[] {
        let sortByFunc: (item: Item) => number | string | undefined
        switch (this.sortConfig.sortBy) {
            case SortBy.custom:
                sortByFunc = (): undefined => undefined
                break
            case SortBy.entityName:
                sortByFunc = (item: Item): string => item.label
                break
            case SortBy.column:
                const owidRowsByEntityName =
                    this.sortColumn?.owidRowsByEntityName
                sortByFunc = (item: Item): number => {
                    const rows = owidRowsByEntityName?.get(item.label)
                    return rows?.[0]?.value ?? 0
                }
                break
            default:
            case SortBy.total:
                sortByFunc = (item: Item): number => {
                    const lastPoint = last(item.bars)?.point
                    if (!lastPoint) return 0
                    return lastPoint.valueOffset + lastPoint.value
                }
        }
        const sortedItems = sortBy(this.items, sortByFunc)
        const sortOrder = this.sortConfig.sortOrder ?? SortOrder.desc
        if (sortOrder === SortOrder.desc) sortedItems.reverse()

        return sortedItems
    }

    @computed private get placedItems(): PlacedItem[] {
        const { innerBounds, barHeight, barSpacing } = this

        const topYOffset = innerBounds.top + barHeight / 2 + barSpacing / 2

        return this.sortedItems.map((d, i) => ({
            yPosition: topYOffset + (barHeight + barSpacing) * i,
            ...d,
        }))
    }

    @computed private get barHeight(): number {
        return (0.8 * this.innerBounds.height) / this.items.length
    }

    @computed private get barSpacing(): number {
        return this.innerBounds.height / this.items.length - this.barHeight
    }

    // legend props

    @computed get legendPaddingTop(): number {
        return this.baseFontSize
    }

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get categoryLegendY(): number {
        return this.bounds.top
    }

    @computed get legendWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.left
    }

    @computed get fontSize(): number {
        return this.baseFontSize
    }

    @computed private get legendBins(): CategoricalBin[] {
        return this.series.map((series, index) => {
            return new CategoricalBin({
                index,
                value: series.seriesName,
                label: series.seriesName,
                color: series.color,
            })
        })
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.showLegend ? this.legendBins : []
    }

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (!this.showLegend) {
            return {
                categoricalLegendData: this.legendBins,
            }
        }
        return undefined
    }

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        this.focusSeriesName = first(
            this.series
                .map((s) => s.seriesName)
                .filter((name) => bin.contains(name))
        )
    }

    @action.bound onLegendMouseLeave(): void {
        this.focusSeriesName = undefined
    }

    @computed private get legend(): HorizontalCategoricalColorLegend {
        return new HorizontalCategoricalColorLegend({ manager: this })
    }

    @computed private get formatColumn(): CoreColumn {
        return this.yColumns[0]
    }

    @computed get availableFacetStrategies(): FacetStrategy[] {
        const strategies = [FacetStrategy.none]

        if (this.yColumns.length > 1) strategies.push(FacetStrategy.metric)

        return strategies
    }

    @bind private formatValueForLabel(value: number): string {
        // Compute how many decimal places we should show.
        // Basically, this makes us show 2 significant digits, or no decimal places if the number
        // is big enough already.
        const magnitude = numberMagnitude(value)
        return this.formatColumn.formatValueShort(value, {
            numDecimalPlaces: Math.max(0, -magnitude + 2),
        })
    }

    @observable tooltipState = new TooltipState<{
        entityName: string
        seriesName?: string
    }>()

    @action.bound private onEntityMouseEnter(
        entityName: string,
        seriesName?: string
    ): void {
        this.tooltipState.target = { entityName, seriesName }
    }

    @action.bound private onMouseMove(ev: React.MouseEvent): void {
        const ref = this.manager.base?.current
        if (ref) {
            this.tooltipState.position = getRelativeMouse(ref, ev)
        }
    }

    @action.bound private onEntityMouseLeave(): void {
        this.tooltipState.target = null
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

        const { manager, bounds, yAxis, innerBounds } = this

        const chartContext: StackedBarChartContext = {
            yAxis,
            targetTime: this.manager.endTime,
            timeColumn: this.inputTable.timeColumn,
            formatColumn: this.formatColumn,
            formatValueForLabel: this.formatValueForLabel,
            barHeight: this.barHeight,
            focusSeriesName: this.focusSeriesName,
            hoverSeriesName: this.tooltipState.target?.seriesName,
            hoverEntityName: this.tooltipState.target?.entityName,
            x0: this.x0,
            baseFontSize: this.baseFontSize,
        }

        const handlePositionUpdate = (d: PlacedItem): HashMap => ({
            translateY: [d.yPosition],
            timing: { duration: 350, ease: easeQuadOut },
        })

        const renderRow = ({
            data,
            state,
        }: {
            data: PlacedItem
            state: { translateY: number }
        }): JSX.Element => {
            const { label, bars, totalValue } = data

            const totalLabel = this.formatValueForLabel(totalValue)
            const showLabelInsideBar = bars.length > 1

            return (
                <g
                    key={label}
                    className="bar"
                    transform={`translate(0, ${state.translateY})`}
                >
                    <text
                        transform={`translate(${
                            yAxis.place(this.x0) - labelToBarPadding
                        }, 0)`}
                        fill="#555"
                        dominantBaseline="middle"
                        textAnchor="end"
                        onMouseEnter={(): void =>
                            this.onEntityMouseEnter(label)
                        }
                        onMouseLeave={this.onEntityMouseLeave}
                        {...this.labelStyle}
                    >
                        {label}
                    </text>
                    {bars.map((bar) => (
                        <StackedDiscreteBarChart.Bar
                            key={bar.seriesName}
                            entity={label}
                            bar={bar}
                            chartContext={chartContext}
                            showLabelInsideBar={showLabelInsideBar}
                            onMouseEnter={this.onEntityMouseEnter}
                            onMouseLeave={this.onEntityMouseLeave}
                        />
                    ))}
                    {this.showTotalValueLabel &&
                        getElementWithHalo(
                            label + "-value-label",
                            <text
                                transform={`translate(${
                                    yAxis.place(totalValue) + labelToBarPadding
                                }, 0)`}
                                dominantBaseline="middle"
                                {...this.totalValueLabelStyle}
                            >
                                {totalLabel}
                            </text>
                        )}
                </g>
            )
        }

        const axisLineWidth = manager.isStaticAndSmall
            ? GRAPHER_AXIS_LINE_WIDTH_THICK
            : GRAPHER_AXIS_LINE_WIDTH_DEFAULT

        return (
            <g
                ref={this.base}
                className="StackedDiscreteBarChart"
                onMouseMove={this.onMouseMove}
            >
                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                {this.showHorizontalAxis && (
                    <HorizontalAxisComponent
                        bounds={bounds}
                        axis={yAxis}
                        preferredAxisPosition={innerBounds.bottom}
                        labelColor={manager.secondaryColorInStaticCharts}
                        tickMarkWidth={axisLineWidth}
                    />
                )}
                <HorizontalAxisGridLines
                    horizontalAxis={yAxis}
                    bounds={innerBounds}
                    strokeWidth={axisLineWidth}
                />
                {this.showLegend && (
                    <HorizontalCategoricalColorLegend manager={this} />
                )}
                <NodeGroup
                    data={this.placedItems}
                    keyAccessor={(d: PlacedItem): string => d.label}
                    start={handlePositionUpdate}
                    update={handlePositionUpdate}
                >
                    {(nodes): JSX.Element => (
                        <g>{nodes.map((node) => renderRow(node))}</g>
                    )}
                </NodeGroup>
                <HorizontalAxisZeroLine
                    horizontalAxis={yAxis}
                    bounds={innerBounds}
                    strokeWidth={axisLineWidth}
                />
                {this.Tooltip}
            </g>
        )
    }

    private static Bar(props: {
        bar: Bar
        entity: string
        chartContext: StackedBarChartContext
        showLabelInsideBar: boolean
        onMouseEnter: (entityName: string, seriesName?: string) => void
        onMouseLeave: () => void
    }): JSX.Element {
        const { entity, bar, chartContext } = props
        const { yAxis, formatValueForLabel, focusSeriesName, barHeight } =
            chartContext

        const isFaint =
            focusSeriesName !== undefined && focusSeriesName !== bar.seriesName
        const isHover =
            chartContext.hoverSeriesName === bar.seriesName &&
            chartContext.hoverEntityName === entity
        const barX = yAxis.place(chartContext.x0 + bar.point.valueOffset)
        const barWidth =
            yAxis.place(bar.point.value) - yAxis.place(chartContext.x0)

        const barLabel = formatValueForLabel(bar.point.value)
        const labelFontSize = 0.75 * chartContext.baseFontSize
        const labelBounds = Bounds.forText(barLabel, {
            fontSize: labelFontSize,
        })
        // Check that we have enough space to show the bar label
        const showLabelInsideBar =
            props.showLabelInsideBar &&
            labelBounds.width < 0.85 * barWidth &&
            labelBounds.height < 0.85 * barHeight
        const labelColor = isDarkColor(bar.color) ? "#fff" : "#000"

        return (
            <g
                onMouseEnter={(): void =>
                    props?.onMouseEnter(entity, bar.seriesName)
                }
                onMouseLeave={props?.onMouseLeave}
            >
                <rect
                    x={0}
                    y={0}
                    transform={`translate(${barX}, ${-barHeight / 2})`}
                    width={barWidth}
                    height={barHeight}
                    fill={bar.color}
                    opacity={
                        isHover
                            ? 1
                            : isFaint
                            ? 0.1
                            : GRAPHER_AREA_OPACITY_DEFAULT
                    }
                    style={{
                        transition: "height 200ms ease",
                    }}
                />
                {showLabelInsideBar && (
                    <text
                        x={barX + barWidth / 2}
                        y={0}
                        width={barWidth}
                        height={barHeight}
                        fill={labelColor}
                        opacity={isFaint ? 0 : 1}
                        fontSize={labelFontSize}
                        textAnchor="middle"
                        dominantBaseline="middle"
                    >
                        {barLabel}
                    </text>
                )}
            </g>
        )
    }

    @computed private get Tooltip(): JSX.Element | undefined {
        const {
                tooltipState: { target, position, fading },
                formatColumn: { unit, shortUnit },
                manager: { endTime: targetTime },
                inputTable: { timeColumn },
            } = this,
            item = this.placedItems.find(
                ({ label }) => label === target?.entityName
            ),
            hasNotice = item?.bars.some(
                ({ point }) => !point.fake && point.time !== targetTime
            ),
            notice = hasNotice ? timeColumn.formatValue(targetTime) : undefined

        return (
            target &&
            item && (
                <Tooltip
                    id="stackedDiscreteBarTooltip"
                    tooltipManager={this.manager}
                    x={position.x}
                    y={position.y}
                    style={{ maxWidth: "400px" }}
                    offsetX={20}
                    offsetY={-16}
                    title={target.entityName}
                    subtitle={unit !== shortUnit ? unit : undefined}
                    subtitleFormat="unit"
                    footer={notice}
                    footerFormat="notice"
                    dissolve={fading}
                >
                    <TooltipTable
                        columns={[this.formatColumn]}
                        totals={[item.totalValue]}
                        rows={item.bars.map((bar) => {
                            const {
                                seriesName: name,
                                color: swatch,
                                point: { value, time, fake: blurred },
                            } = bar

                            return {
                                name,
                                swatch,
                                blurred,
                                focused: name === target.seriesName,
                                values: [!blurred ? value : undefined],
                                notice:
                                    !blurred && time !== targetTime
                                        ? timeColumn.formatValue(time)
                                        : undefined,
                            }
                        })}
                    ></TooltipTable>
                </Tooltip>
            )
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

    @computed protected get yColumnSlugs(): string[] {
        return this.manager.yColumnSlugs ?? autoDetectYColumnSlugs(this.manager)
    }

    @computed protected get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed private get sortColumnSlug(): string | undefined {
        return this.sortConfig.sortColumnSlug
    }

    @computed private get sortColumn(): CoreColumn | undefined {
        return this.sortColumnSlug
            ? this.transformedTable.getColumns([this.sortColumnSlug])[0]
            : undefined
    }

    @computed private get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes[this.manager.baseColorScheme]
                : null) ?? ColorSchemes["owid-distinct"]
        )
    }

    @computed private get categoricalColorAssigner(): CategoricalColorAssigner {
        const seriesCount = this.yColumns.length
        return new CategoricalColorAssigner({
            colorScheme: this.colorScheme,
            invertColorScheme: this.manager.invertColorScheme,
            colorMap: this.inputTable.columnDisplayNameToColorMap,
            autoColorMapCache: this.manager.seriesColorMap,
            numColorsInUse: seriesCount,
        })
    }

    @computed private get unstackedSeries(): StackedSeries<EntityName>[] {
        return (
            this.yColumns
                .map((col) => {
                    return {
                        seriesName: col.displayName,
                        columnSlug: col.slug,
                        color: this.categoricalColorAssigner.assign(
                            col.displayName
                        ),
                        points: col.owidRows.map((row) => ({
                            time: row.time,
                            position: row.entityName,
                            value: row.value,
                            valueOffset: 0,
                        })),
                    }
                })
                // Do not plot columns without data
                .filter((series) => series.points.length > 0)
        )
    }

    @computed get series(): readonly StackedSeries<EntityName>[] {
        return stackSeries(withMissingValuesAsZeroes(this.unstackedSeries))
    }
}
