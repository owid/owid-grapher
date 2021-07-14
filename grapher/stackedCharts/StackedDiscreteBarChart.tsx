import * as React from "react"
import {
    min,
    max,
    maxBy,
    last,
    flatten,
    excludeUndefined,
    sortBy,
    numberMagnitude,
    sum,
} from "../../clientUtils/Util"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds"
import { BASE_FONT_SIZE, SeriesName } from "../core/GrapherConstants"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
} from "../axis/AxisViews"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { AxisConfig } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import { OwidTable } from "../../coreTable/OwidTable"
import { autoDetectYColumnSlugs, makeSelectionArray } from "../chart/ChartUtils"
import {
    stackSeries,
    withMissingValuesAsZeroes,
} from "../stackedCharts/StackedUtils"
import { ChartManager } from "../chart/ChartManager"
import {
    Color,
    SortOrder,
    Time,
    SortBy,
    SortConfig,
} from "../../clientUtils/owidTypes"
import { StackedPoint, StackedSeries } from "./StackedConstants"
import { ColorSchemes } from "../color/ColorSchemes"
import { EntityName } from "../../coreTable/OwidTableConstants"
import {
    LegendAlign,
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin } from "../color/ColorScaleBin"
import { CoreColumn } from "../../coreTable/CoreTableColumns"
import { TippyIfInteractive } from "../chart/Tippy"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"
import { isDarkColor } from "../color/ColorUtils"
import { HorizontalAxis } from "../axis/Axis"
import { SelectionArray } from "../selection/SelectionArray"
import { ColorScheme } from "../color/ColorScheme"
import { NodeGroup } from "react-move"
import { easeQuadOut } from "d3-ease"

const labelToBarPadding = 5

export interface StackedDiscreteBarChartManager extends ChartManager {
    endTime?: Time
}

interface Item {
    label: string
    bars: Bar[]
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

interface TooltipProps extends StackedBarChartContext {
    label: string
    bars: Bar[]
    highlightedSeriesName: string | undefined
}

interface StackedBarChartContext {
    axis: HorizontalAxis
    targetTime?: number
    timeColumn: CoreColumn
    formatColumn: CoreColumn
    focusSeriesName?: string
    barHeight: number
    x0: number
    baseFontSize: number
    isInteractive: boolean
}

@observer
export class StackedDiscreteBarChart
    extends React.Component<{
        bounds?: Bounds
        manager: StackedDiscreteBarChartManager
    }>
    implements ChartInterface, HorizontalColorLegendManager {
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
        if (this.manager.sortConfig) return this.manager.sortConfig

        return {
            sortBy: SortBy.total,
            sortOrder: SortOrder.desc,
        }
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
        return (this.props.bounds ?? DEFAULT_BOUNDS).padRight(10)
    }

    @computed private get baseFontSize(): number {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed private get labelStyle() {
        return {
            fontSize: 0.75 * this.baseFontSize,
            fontWeight: 700,
        }
    }

    // Account for the width of the legend
    @computed private get labelWidth(): number {
        const labels = this.items.map((item) => item.label)
        const longestLabel = maxBy(labels, (d) => d.length)
        return Bounds.forText(longestLabel, this.labelStyle).width
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
        return [this.bounds.left + this.labelWidth, this.bounds.right]
    }

    @computed private get yAxis(): AxisConfig {
        return this.manager.yAxis || new AxisConfig()
    }

    @computed private get axis(): HorizontalAxis {
        // NB: We use the user's YAxis options here to make the XAxis
        const axis = this.yAxis.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.xDomainDefault)

        axis.formatColumn = this.yColumns[0] // todo: does this work for columns as series?
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds
            .padLeft(this.labelWidth)
            .padBottom(this.axis.height)
            .padTop(this.legendPaddingTop)
            .padTop(this.legend.height)
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    @computed private get items(): readonly Item[] {
        const entityNames = this.selectionArray.selectedEntityNames
        const items = entityNames
            .map((entityName) => ({
                label: entityName,
                bars: excludeUndefined(
                    this.series.map((series) => {
                        const point = series.points.find(
                            (point) => point.position === entityName
                        )
                        if (!point) return undefined
                        return {
                            point,
                            columnSlug: series.columnSlug,
                            color: series.color,
                            seriesName: series.seriesName,
                        }
                    })
                ),
            }))
            .filter((item) => item.bars.length)

        return items
    }

    @computed get sortedItems(): readonly Item[] {
        let sortState = { ...this.sortConfig }

        if (this.manager.isRelativeMode && sortState.sortBy === SortBy.total) {
            // In relative mode, where the values for every entity sum up to 100%, sorting by total
            // doesn't make sense. It's also jumpy because of some rounding errors. For this reason,
            // we sort by entity name instead.
            sortState = {
                ...sortState,
                sortBy: SortBy.entityName,
                sortOrder: SortOrder.asc,
            }
        }

        let sortByFunc: (item: Item) => number | string
        switch (sortState.sortBy) {
            case SortBy.entityName:
                sortByFunc = (item: Item): string => item.label
                break
            case SortBy.column:
                const sortColumnSlug = sortState.sortColumnSlug
                sortByFunc = (item: Item): number =>
                    item.bars.find((b) => b.columnSlug === sortColumnSlug)
                        ?.point.value ?? 0
                break
            case SortBy.total:
                sortByFunc = (item: Item): number => {
                    const lastPoint = last(item.bars)?.point
                    if (!lastPoint) return 0
                    return lastPoint.valueOffset + lastPoint.value
                }
        }
        const sortedItems = sortBy(this.items, sortByFunc)
        if (sortState.sortOrder === SortOrder.desc) sortedItems.reverse()

        return sortedItems
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

    @computed get legendAlign(): LegendAlign {
        return LegendAlign.left
    }

    @computed get fontSize(): number {
        return this.baseFontSize
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.series.map((series, index) => {
            return new CategoricalBin({
                index,
                value: series.seriesName,
                label: series.seriesName,
                color: series.color,
            })
        })
    }

    @action.bound onLegendMouseOver(bin: CategoricalBin): void {
        this.focusSeriesName = bin.value
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

    render(): JSX.Element {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )

        const { bounds, axis, innerBounds, barHeight, barSpacing } = this

        const chartContext: StackedBarChartContext = {
            axis,
            targetTime: this.manager.endTime,
            timeColumn: this.inputTable.timeColumn,
            formatColumn: this.formatColumn,
            barHeight: this.barHeight,
            focusSeriesName: this.focusSeriesName,
            x0: this.x0,
            baseFontSize: this.baseFontSize,
            isInteractive: !this.manager.isExportingtoSvgOrPng,
        }

        const yOffset = innerBounds.top + barHeight / 2
        const placedItems = this.sortedItems.map((d, i) => ({
            yPosition: yOffset + (barHeight + barSpacing) * i,
            ...d,
        }))

        const handlePositionUpdate = (d: PlacedItem) => ({
            translateY: [d.yPosition],
            timing: { duration: 350, ease: easeQuadOut },
        })

        return (
            <g ref={this.base} className="StackedDiscreteBarChart">
                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                <HorizontalAxisComponent
                    bounds={bounds}
                    axis={axis}
                    axisPosition={innerBounds.bottom}
                />
                <HorizontalAxisGridLines
                    horizontalAxis={axis}
                    bounds={innerBounds}
                />
                <HorizontalCategoricalColorLegend manager={this} />
                <NodeGroup
                    data={placedItems}
                    keyAccessor={(d: PlacedItem) => d.label}
                    start={handlePositionUpdate}
                    update={handlePositionUpdate}
                >
                    {(nodes) => (
                        <g>
                            {nodes.map(({ data, state }) => {
                                const { label, bars } = data as PlacedItem
                                const tooltipProps = {
                                    ...chartContext,
                                    label,
                                    bars,
                                }

                                return (
                                    <g
                                        key={label}
                                        className="bar"
                                        transform={`translate(0, ${state.translateY})`}
                                    >
                                        <TippyIfInteractive
                                            lazy
                                            isInteractive={
                                                !this.manager
                                                    .isExportingtoSvgOrPng
                                            }
                                            hideOnClick={false}
                                            content={
                                                <StackedDiscreteBarChart.Tooltip
                                                    {...tooltipProps}
                                                    highlightedSeriesName={
                                                        undefined
                                                    }
                                                />
                                            }
                                        >
                                            <text
                                                x={0}
                                                y={0}
                                                transform={`translate(${
                                                    axis.place(this.x0) -
                                                    labelToBarPadding
                                                }, 0)`}
                                                fill="#555"
                                                dominantBaseline="middle"
                                                textAnchor="end"
                                                {...this.labelStyle}
                                            >
                                                {label}
                                            </text>
                                        </TippyIfInteractive>
                                        {bars.map((bar) => (
                                            <StackedDiscreteBarChart.Bar
                                                key={bar.seriesName}
                                                bar={bar}
                                                chartContext={chartContext}
                                                tooltipProps={{
                                                    ...tooltipProps,
                                                    highlightedSeriesName:
                                                        bar.seriesName,
                                                }}
                                            />
                                        ))}
                                    </g>
                                )
                            })}
                        </g>
                    )}
                </NodeGroup>
            </g>
        )
    }

    private static Bar(props: {
        bar: Bar
        chartContext: StackedBarChartContext
        tooltipProps: TooltipProps
    }): JSX.Element {
        const { bar, chartContext, tooltipProps } = props
        const { axis, formatColumn, focusSeriesName, barHeight } = chartContext

        const isFaint =
            focusSeriesName !== undefined && focusSeriesName !== bar.seriesName
        const barX = axis.place(chartContext.x0 + bar.point.valueOffset)
        const barWidth =
            axis.place(bar.point.value) - axis.place(chartContext.x0)

        // Compute how many decimal places we should show.
        // Basically, this makes us show 2 significant digits, or no decimal places if the number
        // is big enough already.
        const magnitude = numberMagnitude(bar.point.value)
        const barLabel = formatColumn.formatValueShort(bar.point.value, {
            numDecimalPlaces: Math.max(0, -magnitude + 2),
        })
        const labelFontSize = 0.7 * chartContext.baseFontSize
        const labelBounds = Bounds.forText(barLabel, {
            fontSize: labelFontSize,
        })
        // Check that we have enough space to show the bar label
        const showLabelInsideBar =
            labelBounds.width < 0.85 * barWidth &&
            labelBounds.height < 0.85 * barHeight
        const labelColor = isDarkColor(bar.color) ? "#fff" : "#000"

        return (
            <TippyIfInteractive
                lazy
                isInteractive={chartContext.isInteractive}
                key={bar.seriesName}
                hideOnClick={false}
                content={<StackedDiscreteBarChart.Tooltip {...tooltipProps} />}
            >
                <g>
                    <rect
                        x={0}
                        y={0}
                        transform={`translate(${barX}, ${-barHeight / 2})`}
                        width={barWidth}
                        height={barHeight}
                        fill={bar.color}
                        opacity={isFaint ? 0.1 : 0.85}
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
            </TippyIfInteractive>
        )
    }

    private static Tooltip(props: TooltipProps): JSX.Element {
        let hasTimeNotice = false
        const { highlightedSeriesName } = props
        const showTotal = !props.bars.some((bar) => bar.point.fake) // If some data is missing, don't calculate a total

        const timeNoticeStyle = {
            fontWeight: "normal",
            color: "#707070",
            fontSize: "0.8em",
            whiteSpace: "nowrap",
            paddingLeft: "8px",
        } as React.CSSProperties

        return (
            <table
                style={{
                    lineHeight: "1em",
                    whiteSpace: "normal",
                    borderSpacing: "0.5em",
                }}
            >
                <tbody>
                    <tr>
                        <td colSpan={4} style={{ color: "#111" }}>
                            <strong>{props.label}</strong>
                        </td>
                    </tr>
                    {props.bars.map((bar) => {
                        const squareColor = bar.color
                        const isHighlighted =
                            bar.seriesName === highlightedSeriesName
                        const isFaint =
                            highlightedSeriesName !== null && !isHighlighted
                        const shouldShowTimeNotice =
                            !bar.point.fake &&
                            bar.point.time !== props.targetTime
                        hasTimeNotice ||= shouldShowTimeNotice

                        return (
                            <tr
                                key={`${bar.seriesName}`}
                                style={{
                                    color: isHighlighted
                                        ? "#000"
                                        : isFaint
                                        ? "#707070"
                                        : "#444",
                                    fontWeight: isHighlighted
                                        ? "bold"
                                        : undefined,
                                }}
                            >
                                <td>
                                    <div
                                        style={{
                                            width: "10px",
                                            height: "10px",
                                            backgroundColor: squareColor,
                                            display: "inline-block",
                                        }}
                                    />
                                </td>
                                <td
                                    style={{
                                        paddingRight: "0.8em",
                                        fontSize: "0.9em",
                                    }}
                                >
                                    {bar.seriesName}
                                </td>
                                <td
                                    style={{
                                        textAlign: "right",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {bar.point.fake
                                        ? "No data"
                                        : props.formatColumn.formatValueShort(
                                              bar.point.value,
                                              {
                                                  noTrailingZeroes: false,
                                              }
                                          )}
                                </td>
                                {shouldShowTimeNotice && (
                                    <td style={timeNoticeStyle}>
                                        <span className="icon">
                                            <FontAwesomeIcon
                                                icon={faInfoCircle}
                                                style={{
                                                    marginRight: "0.25em",
                                                }}
                                            />{" "}
                                        </span>
                                        {props.timeColumn.formatValue(
                                            bar.point.time
                                        )}
                                    </td>
                                )}
                            </tr>
                        )
                    })}
                    {/* Total */}
                    {showTotal && (
                        <tr
                            style={{
                                color: "#000",
                                fontWeight: highlightedSeriesName
                                    ? undefined
                                    : "bold",
                            }}
                        >
                            <td />
                            <td
                                style={{
                                    paddingRight: "0.8em",
                                    fontSize: "0.9em",
                                }}
                            >
                                Total
                            </td>
                            <td
                                style={{
                                    textAlign: "right",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {props.formatColumn.formatValueShort(
                                    sum(
                                        props.bars.map((bar) => bar.point.value)
                                    ),
                                    {
                                        noTrailingZeroes: false,
                                    }
                                )}
                            </td>
                            {/* If we're showing a time notice for some year already, then also show it for the total */}
                            {hasTimeNotice && (
                                <td style={timeNoticeStyle}>
                                    <span className="icon">
                                        <FontAwesomeIcon icon={faInfoCircle} />
                                    </span>
                                </td>
                            )}
                        </tr>
                    )}
                    {hasTimeNotice && (
                        <tr>
                            <td
                                colSpan={4}
                                style={{
                                    ...timeNoticeStyle,
                                    paddingLeft: undefined,
                                    whiteSpace: undefined,
                                    paddingTop: "10px",
                                }}
                            >
                                <div style={{ display: "flex" }}>
                                    <span
                                        className="icon"
                                        style={{ marginRight: "0.5em" }}
                                    >
                                        <FontAwesomeIcon icon={faInfoCircle} />{" "}
                                    </span>
                                    <span>
                                        No data available for{" "}
                                        {props.timeColumn.formatValue(
                                            props.targetTime
                                        )}
                                        . Showing closest available data point
                                        instead.
                                    </span>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
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

    @computed protected get yColumnSlugs(): string[] {
        return (
            this.manager.yColumnSlugsInSelectionOrder ??
            autoDetectYColumnSlugs(this.manager)
        )
    }

    @computed protected get yColumns(): CoreColumn[] {
        return this.transformedTable.getColumns(this.yColumnSlugs)
    }

    @computed private get colorScheme(): ColorScheme {
        return (
            (this.manager.baseColorScheme
                ? ColorSchemes[this.manager.baseColorScheme]
                : undefined) ?? ColorSchemes["owid-distinct"]
        )
    }

    @computed private get unstackedSeries(): StackedSeries<EntityName>[] {
        return (
            this.yColumns
                .map((col, i) => {
                    return {
                        seriesName: col.displayName,
                        columnSlug: col.slug,
                        color:
                            col.def.color ??
                            this.colorScheme.getColors(this.yColumns.length)[i],
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
