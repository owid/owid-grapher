import * as _ from "lodash-es"
import React from "react"
import * as R from "remeda"
import {
    Bounds,
    Time,
    HorizontalAlign,
    EntityName,
    excludeUndefined,
    numberMagnitude,
    getRelativeMouse,
    exposeInstanceOnWindow,
    makeFigmaId,
    bind,
} from "@ourworldindata/utils"
import { action, computed, makeObservable, observable } from "mobx"
import { observer } from "mobx-react"
import { ScaleType, SeriesName } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    FontSettings,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
    HorizontalAxisZeroLine,
} from "../axis/AxisViews"
import { AxisConfig } from "../axis/AxisConfig"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
    toTooltipTableColumns,
} from "../tooltip/Tooltip"
import {
    LEGEND_STYLE_FOR_STACKED_CHARTS,
    StackedPoint,
    StackedSeries,
} from "./StackedConstants"
import {
    PlacedDiscreteBarRow,
    RenderBarSegment,
    RenderDiscreteBarRow,
    SizedDiscreteBarRow,
} from "./StackedDiscreteBarChartConstants.js"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../legend/HorizontalColorLegends"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { Emphasis, resolveEmphasis } from "../interaction/Emphasis"
import { HorizontalAxis } from "../axis/Axis"
import { StackedDiscreteBarChartState } from "./StackedDiscreteBarChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { StackedDiscreteBarRow } from "./StackedDiscreteBarRow"
import { enrichSeriesWithLabels } from "../barCharts/DiscreteBarChartHelpers.js"
import { AnimatedRows } from "../animation/AnimatedRows.js"
import { InteractionState } from "../interaction/InteractionState.js"

export interface StackedDiscreteBarChartManager extends ChartManager {
    endTime?: Time
    hideTotalValueLabel?: boolean
}

const BAR_SPACING_FACTOR = 0.35

type StackedDiscreteBarChartProps =
    ChartComponentProps<StackedDiscreteBarChartState> & {
        hideLegend?: boolean
    }

@observer
export class StackedDiscreteBarChart
    extends React.Component<StackedDiscreteBarChartProps>
    implements ChartInterface, HorizontalColorLegendManager
{
    private base = React.createRef<SVGGElement>()

    private legendHoverSeriesName: SeriesName | undefined = undefined

    private tooltipState = new TooltipState<{
        entityName: string
        seriesName?: string
    }>()

    constructor(props: StackedDiscreteBarChartProps) {
        super(props)

        makeObservable<
            StackedDiscreteBarChart,
            "tooltipState" | "legendHoverSeriesName"
        >(this, {
            legendHoverSeriesName: observable,
            tooltipState: observable,
        })
    }

    @computed get chartState(): StackedDiscreteBarChartState {
        return this.props.chartState
    }

    @computed private get manager(): StackedDiscreteBarChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        // Bottom padding avoids axis labels to be cut off at some resolutions
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS)
            .padRight(10)
            .padBottom(2)
    }

    @computed private get baseFontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed private get showLegend(): boolean {
        return !this.props.hideLegend && !!this.manager.showLegend
    }

    @computed private get boundsWithoutLegend(): Bounds {
        return this.bounds.padTop(
            this.showLegend && this.legend.height > 0
                ? this.legend.height + this.legendPaddingTop
                : 0
        )
    }

    @computed private get legendPaddingTop(): number {
        return 0.5 * this.baseFontSize
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

    /**
     * In stacked discrete bar charts, both entities and columns can be focused.
     * This getter returns the focused series names, grouped by whether they are
     * entities or columns.
     */
    @computed get focusedSeriesNamesByType(): Record<
        "entity" | "column",
        SeriesName[]
    > {
        const {
            focusArray,
            selectionArray: { selectedEntityNames },
        } = this.chartState

        const [focusedEntities, focusedColumns] = R.partition(
            focusArray.seriesNames,
            (seriesName) => selectedEntityNames.includes(seriesName)
        )

        return { entity: focusedEntities, column: focusedColumns }
    }

    resolveLegendBinEmphasis(bin: ColorScaleBin): Emphasis {
        const { focusArray } = this.chartState

        // If an entity is focused, then all legend bins are active
        if (this.focusedSeriesNamesByType.entity.length > 0) {
            return Emphasis.Default
        }

        // Check if the legend bin is currently hovered
        if (this.legendHoverSeriesName) {
            return bin.contains(this.legendHoverSeriesName)
                ? Emphasis.Highlighted
                : Emphasis.Muted
        }

        // Check if a bar segment is currently hovered that maps to the legend bin
        if (this.tooltipState.target?.seriesName) {
            return bin.contains(this.tooltipState.target.seriesName)
                ? Emphasis.Highlighted
                : Emphasis.Muted
        }

        // Check if a column is focused that corresponds to the legend bin
        if (this.focusedSeriesNamesByType.column.length > 0) {
            const binSeriesName = this.series.find((s) =>
                bin.contains(s.seriesName)
            )?.seriesName
            return binSeriesName && focusArray.has(binSeriesName)
                ? Emphasis.Highlighted
                : Emphasis.Muted
        }

        return Emphasis.Default
    }

    legendStyleConfig = LEGEND_STYLE_FOR_STACKED_CHARTS

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (!this.showLegend) {
            return {
                categoricalLegendData: this.legendBins,
                legendStyleConfig: this.legendStyleConfig,
            }
        }
        return undefined
    }

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        this.chartState.focusArray.clear()
        this.legendHoverSeriesName = R.first(
            this.series
                .map((s) => s.seriesName)
                .filter((name) => bin.contains(name))
        )
    }

    @action.bound onLegendMouseLeave(): void {
        this.legendHoverSeriesName = undefined
    }

    @computed private get legend(): HorizontalCategoricalColorLegend {
        return new HorizontalCategoricalColorLegend({ manager: this })
    }

    @action.bound private onMouseMove(ev: React.MouseEvent): void {
        const ref = this.manager.base?.current
        if (ref) {
            this.tooltipState.position = getRelativeMouse(ref, ev)
        }
    }

    @computed private get series(): readonly StackedSeries<EntityName>[] {
        return this.chartState.series
    }

    @computed private get barCount(): number {
        return this.chartState.rows.length
    }

    @computed private get labelFontSize(): number {
        const availableHeight = this.boundsWithoutLegend.height / this.barCount
        return Math.min(
            GRAPHER_FONT_SCALE_12 * this.fontSize,
            1.1 * availableHeight
        )
    }

    @computed private get labelStyle(): FontSettings {
        return { fontSize: this.labelFontSize, fontWeight: 700, lineHeight: 1 }
    }

    @computed private get totalValueLabelStyle(): Partial<FontSettings> {
        return { fontSize: this.labelFontSize }
    }

    @computed private get sizedRows(): readonly SizedDiscreteBarRow[] {
        return enrichSeriesWithLabels({
            series: this.chartState.sortedRows,
            availableHeightPerSeries:
                this.boundsWithoutLegend.height / this.barCount,
            minLabelWidth: 0.3 * this.boundsWithoutLegend.width,
            maxLabelWidth: 0.66 * this.boundsWithoutLegend.width,
            fontSettings: this.labelStyle,
            showRegionTooltip: !this.manager.isStatic,
        })
    }

    @computed private get labelWidth(): number {
        return _.max(this.sizedRows.map((d) => d.label.width)) ?? 0
    }

    @computed private get showTotalValueLabel(): boolean {
        return !this.manager.isRelativeMode && !this.manager.hideTotalValueLabel
    }

    @computed private get showHorizontalAxis(): boolean {
        return !this.showTotalValueLabel
    }

    // The amount of space we need to allocate for total value labels on the right
    @computed private get totalValueLabelWidth(): number {
        if (!this.showTotalValueLabel) return 0

        const labels = this.sizedRows.map((d) =>
            this.formatValueForLabel(d.totalValue)
        )
        const longestLabel = _.maxBy(labels, (l) => l.length)
        return Bounds.forText(longestLabel, this.totalValueLabelStyle).width
    }

    @computed private get x0(): number {
        return 0
    }

    @computed private get allPoints(): StackedPoint<EntityName>[] {
        return this.series.flatMap((series) => series.points)
    }

    @computed private get xDomainDefault(): [number, number] {
        const maxValues = this.allPoints.map(
            (point) => point.value + point.valueOffset
        )
        return [this.x0, Math.max(this.x0, _.max(maxValues) as number)]
    }

    @computed private get xRange(): [number, number] {
        return [
            this.boundsWithoutLegend.left + this.labelWidth,
            this.boundsWithoutLegend.right - this.totalValueLabelWidth,
        ]
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(this.manager.yAxisConfig, this)
    }

    @computed get yAxis(): HorizontalAxis {
        const axis = this.yAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.xDomainDefault)

        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.yColumns[0]
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed private get innerBounds(): Bounds {
        return this.boundsWithoutLegend
            .padLeft(this.labelWidth)
            .padBottom(this.showHorizontalAxis ? this.yAxis.height : 0)
            .padRight(this.totalValueLabelWidth)
    }

    /** The total height of the series, i.e. the height of the bar + the white space around it */
    @computed private get seriesHeight(): number {
        return this.innerBounds.height / this.barCount
    }

    @computed private get barSpacing(): number {
        return this.seriesHeight * BAR_SPACING_FACTOR
    }

    @computed private get barHeight(): number {
        const totalWhiteSpace = this.barCount * this.barSpacing
        return (this.innerBounds.height - totalWhiteSpace) / this.barCount
    }

    @computed private get isHoverModeActive(): boolean {
        return (
            this.legendHoverSeriesName !== undefined ||
            this.tooltipState.target?.seriesName !== undefined ||
            this.tooltipState.target?.entityName !== undefined
        )
    }

    @computed private get placedRows(): PlacedDiscreteBarRow[] {
        const { innerBounds, barHeight, barSpacing, yAxis, x0 } = this

        const topYOffset = innerBounds.top + barHeight / 2 + barSpacing / 2

        return this.sizedRows.map((d, i) => ({
            ...d,
            yPosition: topYOffset + (barHeight + barSpacing) * i,
            placedBars: d.bars.map((bar) => {
                let barX = yAxis.place(x0 + bar.point.valueOffset)
                const barWidth = Math.abs(
                    yAxis.place(bar.point.value) - yAxis.place(x0)
                )
                if (bar.point.value < 0) barX -= barWidth
                return { ...bar, x: barX, barWidth }
            }),
        }))
    }

    @computed private get renderRows(): RenderDiscreteBarRow[] {
        const {
            legendHoverSeriesName,
            tooltipState: { target },
            chartState: { focusArray },
        } = this

        return this.placedRows.map((row) => {
            // Check if the row is focused
            const rowFocus = focusArray.state(row.entityName)

            // Check if any of the bar segments is focused
            const segments: RenderBarSegment[] = row.placedBars.map(
                (placedBar) => {
                    // Check if the bar segment is hovered
                    const isHovered =
                        legendHoverSeriesName === placedBar.seriesName ||
                        // The bar segment itself is hovered
                        (target?.seriesName === placedBar.seriesName &&
                            target.entityName === row.entityName) ||
                        // The whole row is hovered
                        (target?.entityName === row.entityName &&
                            target.seriesName === undefined)

                    // Check if the bar segment is focused
                    const isFocused =
                        rowFocus.active ||
                        focusArray.state(placedBar.seriesName).active

                    const hover = new InteractionState(
                        isHovered,
                        this.isHoverModeActive
                    )
                    const focus = new InteractionState(
                        isFocused,
                        !focusArray.isEmpty
                    )

                    const emphasis = resolveEmphasis({ hover, focus })

                    return { ...placedBar, hover, focus, emphasis }
                }
            )

            const hasHighlightedSegment = segments.some(
                (segment) => segment.emphasis === Emphasis.Highlighted
            )
            const rowEmphasis = hasHighlightedSegment
                ? Emphasis.Default
                : resolveEmphasis({ focus: rowFocus })

            return { ...row, emphasis: rowEmphasis, segments }
        })
    }

    @computed private get formatColumn(): CoreColumn {
        return this.yColumns[0]
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

    @computed private get inputTable(): OwidTable {
        return this.chartState.inputTable
    }

    @computed private get yColumns(): CoreColumn[] {
        return this.chartState.yColumns
    }

    @action.bound private clearTooltip(): void {
        this.tooltipState.target = null
    }

    @action.bound private onEntityMouseEnter(
        entityName: string,
        seriesName?: string
    ): void {
        this.chartState.focusArray.clear()
        this.tooltipState.target = { entityName, seriesName }
    }

    @action.bound private onEntityMouseLeave(): void {
        this.clearTooltip()
    }

    @computed private get tooltip(): React.ReactElement | undefined {
        const {
                tooltipState: { target, position, fading },
                formatColumn: { displayUnit },
                manager: { endTime: targetTime },
                inputTable: { timeColumn },
            } = this,
            item = this.placedRows.find(
                ({ entityName }) => entityName === target?.entityName
            ),
            hasNotice = item?.bars.some(
                ({ point }) =>
                    !point.missing &&
                    !point.interpolated &&
                    point.time !== targetTime
            ),
            targetNotice = hasNotice
                ? timeColumn.formatValue(targetTime)
                : undefined

        const toleranceNotice = targetNotice
            ? {
                  icon: TooltipFooterIcon.Notice,
                  text: makeTooltipToleranceNotice(targetNotice),
              }
            : undefined
        const roundingNotice = this.formatColumn.roundsToSignificantFigures
            ? {
                  icon: TooltipFooterIcon.None,
                  text: makeTooltipRoundingNotice([
                      this.formatColumn.numSignificantFigures,
                  ]),
              }
            : undefined
        const footer = excludeUndefined([toleranceNotice, roundingNotice])

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
                    subtitle={displayUnit}
                    subtitleFormat="unit"
                    footer={footer}
                    dissolve={fading}
                    dismiss={() => (this.tooltipState.target = null)}
                >
                    <TooltipTable
                        columns={toTooltipTableColumns(this.formatColumn)}
                        totals={[item.totalValue]}
                        rows={item.bars.map((bar) => {
                            const {
                                seriesName: name,
                                color,
                                point: { value, time, missing, interpolated },
                            } = bar

                            const blurred = missing || interpolated

                            return {
                                name,
                                swatch: { color },
                                blurred,
                                focused: name === target.seriesName,
                                values: [!blurred ? value : undefined],
                                originalTime:
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

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }

    private renderLegend(): React.ReactElement | undefined {
        if (!this.showLegend) return
        return <HorizontalCategoricalColorLegend manager={this} />
    }

    private renderAxis(): React.ReactElement {
        const { boundsWithoutLegend: bounds, yAxis, innerBounds } = this

        return (
            <>
                {this.showHorizontalAxis && (
                    <>
                        <HorizontalAxisComponent
                            bounds={bounds}
                            axis={yAxis}
                            preferredAxisPosition={innerBounds.bottom}
                        />
                        <HorizontalAxisGridLines
                            horizontalAxis={yAxis}
                            bounds={innerBounds}
                        />
                    </>
                )}
                <HorizontalAxisZeroLine
                    horizontalAxis={yAxis}
                    bounds={innerBounds}
                    strokeWidth={0.5}
                    // Moves the zero line a little to the left
                    // to avoid overlap with the bars
                    align={HorizontalAlign.right}
                />
            </>
        )
    }

    private renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderLegend()}
                {this.renderAxis()}
                <g id={makeFigmaId("bars")}>
                    {this.renderRows.map((row) => (
                        <StackedDiscreteBarRow
                            key={row.entityName}
                            row={row}
                            y={row.yPosition}
                            yAxis={this.yAxis}
                            barHeight={this.barHeight}
                            labelFontSize={this.labelFontSize}
                            showTotalValueLabel={this.showTotalValueLabel}
                            formatValueForLabel={this.formatValueForLabel}
                            onEntityMouseEnter={this.onEntityMouseEnter}
                            onEntityMouseLeave={this.onEntityMouseLeave}
                            onClearTooltip={this.clearTooltip}
                        />
                    ))}
                </g>
            </>
        )
    }

    private renderInteractive(): React.ReactElement {
        const { bounds } = this

        return (
            <g ref={this.base} onMouseMove={this.onMouseMove}>
                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                {this.renderLegend()}
                {this.renderAxis()}
                <AnimatedRows
                    items={this.renderRows}
                    keyAccessor={(d) => d.entityName}
                    getY={(d) => d.yPosition}
                    renderRow={(row) => (
                        <StackedDiscreteBarRow
                            key={row.entityName}
                            row={row}
                            barHeight={this.barHeight}
                            labelFontSize={this.labelFontSize}
                            yAxis={this.yAxis}
                            showTotalValueLabel={this.showTotalValueLabel}
                            formatValueForLabel={this.formatValueForLabel}
                            onEntityMouseEnter={this.onEntityMouseEnter}
                            onEntityMouseLeave={this.onEntityMouseLeave}
                            onClearTooltip={this.clearTooltip}
                        />
                    )}
                />
                {this.tooltip}
            </g>
        )
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }
}
