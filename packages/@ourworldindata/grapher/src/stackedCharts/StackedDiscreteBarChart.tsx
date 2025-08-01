import * as _ from "lodash-es"
import React from "react"
import * as R from "remeda"
import {
    Bounds,
    excludeUndefined,
    numberMagnitude,
    Color,
    SortOrder,
    Time,
    SortBy,
    SortConfig,
    HorizontalAlign,
    EntityName,
    getRelativeMouse,
    makeIdForHumanConsumption,
    dyFromAlign,
    exposeInstanceOnWindow,
} from "@ourworldindata/utils"
import { action, computed, makeObservable, observable } from "mobx"
import { observer } from "mobx-react"
import { ScaleType, SeriesName, VerticalAlign } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_AREA_OPACITY_DEFAULT,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
    HorizontalAxisZeroLine,
} from "../axis/AxisViews"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { AxisConfig } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { getShortNameForEntity } from "../chart/ChartUtils"
import { ChartManager } from "../chart/ChartManager"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
} from "../tooltip/Tooltip"
import { StackedPoint, StackedSeries } from "./StackedConstants"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { isDarkColor } from "../color/ColorUtils"
import { HorizontalAxis } from "../axis/Axis"
import { SelectionArray } from "../selection/SelectionArray"
import { HashMap, NodeGroup } from "react-move"
import { easeQuadOut } from "d3-ease"
import { bind } from "decko"
import { TextWrap } from "@ourworldindata/components"
import { StackedDiscreteBarChartState } from "./StackedDiscreteBarChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"

// if an entity name exceeds this width, we use the short name instead (if available)
const SOFT_MAX_LABEL_WIDTH = 90

const BAR_SPACING_FACTOR = 0.35

const labelToBarPadding = 5

export interface StackedDiscreteBarChartManager extends ChartManager {
    endTime?: Time
    hideTotalValueLabel?: boolean
}

interface Item {
    entityName: string
    shortEntityName?: string
    label: TextWrap
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

type StackedDiscreteBarChartProps =
    ChartComponentProps<StackedDiscreteBarChartState>

@observer
export class StackedDiscreteBarChart
    extends React.Component<StackedDiscreteBarChartProps>
    implements ChartInterface, HorizontalColorLegendManager
{
    base = React.createRef<SVGGElement>()

    constructor(props: StackedDiscreteBarChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get sortConfig(): SortConfig {
        return this.chartState.sortConfig
    }

    @observable focusSeriesName?: SeriesName

    @computed get chartState(): StackedDiscreteBarChartState {
        return this.props.chartState
    }

    @computed private get manager(): StackedDiscreteBarChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        // bottom padding avoids axis labels to be cut off at some resolutions
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
        return !!this.manager.showLegend
    }

    @computed private get barCount(): number {
        return this.items.length
    }

    @computed private get labelFontSize(): number {
        // can't use `this.barHeight` due to a circular dependency
        const barHeight = this.approximateBarHeight
        return Math.min(
            GRAPHER_FONT_SCALE_12 * this.fontSize,

            1.1 * barHeight
        )
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
        return _.max(this.sizedItems.map((d) => d.label.width)) ?? 0
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

        const labels = this.sizedItems.map((d) =>
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

    // Now we can work out the main x axis scale
    @computed private get xDomainDefault(): [number, number] {
        const maxValues = this.allPoints.map(
            (point) => point.value + point.valueOffset
        )
        return [this.x0, Math.max(this.x0, _.max(maxValues) as number)]
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

        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.yColumns[0] // todo: does this work for columns as series?
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed private get boundsWithoutLegend(): Bounds {
        return this.bounds.padTop(
            this.showLegend && this.legend.height > 0
                ? this.legend.height + this.legendPaddingTop
                : 0
        )
    }

    @computed private get innerBounds(): Bounds {
        return this.boundsWithoutLegend
            .padLeft(this.labelWidth)
            .padBottom(this.showHorizontalAxis ? this.yAxis.height : 0)
            .padRight(this.totalValueLabelWidth)
    }

    @computed private get selectionArray(): SelectionArray {
        return this.chartState.selectionArray
    }

    @computed private get items(): readonly Omit<Item, "label">[] {
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
                    entityName,
                    shortEntityName: getShortNameForEntity(entityName),
                    bars,
                    totalValue,
                }
            })
            .filter((item) => item.bars.length)

        return items
    }

    @computed private get sizedItems(): readonly Item[] {
        // can't use `this.barHeight` due to a circular dependency
        const barHeight = this.approximateBarHeight

        return this.items.map((item) => {
            // make sure we're dealing with a single-line text fragment
            const entityName = item.entityName.replace(/\n/g, " ").trim()

            const maxLegendWidth = 0.3 * this.boundsWithoutLegend.width

            let label = new TextWrap({
                text: entityName,
                maxWidth: maxLegendWidth,
                ...this.labelStyle,
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
                    ...this.labelStyle,
                })
                step += 1
            }

            // if the label is too long, use the short name instead
            const tooLong =
                label.width > SOFT_MAX_LABEL_WIDTH ||
                label.width > maxLegendWidth
            if (tooLong && item.shortEntityName) {
                label = new TextWrap({
                    text: item.shortEntityName,
                    maxWidth: label.maxWidth,
                    ...this.labelStyle,
                })
            }

            return { ...item, label }
        })
    }

    @computed get sortedItems(): readonly Item[] {
        let sortByFunc: (item: Item) => number | string | undefined
        switch (this.sortConfig.sortBy) {
            case SortBy.custom:
                sortByFunc = (): undefined => undefined
                break
            case SortBy.entityName:
                sortByFunc = (item: Item): string => item.entityName
                break
            case SortBy.column: {
                const owidRowsByEntityName =
                    this.sortColumn?.owidRowsByEntityName
                sortByFunc = (item: Item): number => {
                    const rows = owidRowsByEntityName?.get(item.entityName)
                    return rows?.[0]?.value ?? 0
                }
                break
            }
            default:
            case SortBy.total:
                sortByFunc = (item: Item): number => item.totalValue
        }
        const sortedItems = _.sortBy(this.sizedItems, sortByFunc)
        const sortOrder = this.sortConfig.sortOrder ?? SortOrder.desc
        if (sortOrder === SortOrder.desc) return sortedItems.toReversed()
        else return sortedItems
    }

    @computed private get placedItems(): PlacedItem[] {
        const { innerBounds, barHeight, barSpacing } = this

        const topYOffset = innerBounds.top + barHeight / 2 + barSpacing / 2

        return this.sortedItems.map((d, i) => ({
            yPosition: topYOffset + (barHeight + barSpacing) * i,
            ...d,
        }))
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

    // useful if `barHeight` can't be used due to a cyclic dependency
    // keep in mind though that this is not exactly the same as `barHeight`
    @computed private get approximateBarHeight(): number {
        const { height } = this.boundsWithoutLegend
        const approximateMaxBarHeight = height / this.barCount
        const approximateBarSpacing =
            approximateMaxBarHeight * BAR_SPACING_FACTOR
        const totalWhiteSpace = this.barCount * approximateBarSpacing
        return (height - totalWhiteSpace) / this.barCount
    }

    // legend props

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

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (!this.showLegend) {
            return {
                categoricalLegendData: this.legendBins,
            }
        }
        return undefined
    }

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        this.focusSeriesName = R.first(
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

    @computed private get inputTable(): OwidTable {
        return this.chartState.inputTable
    }

    @computed private get chartContext(): StackedBarChartContext {
        return {
            yAxis: this.yAxis,
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
    }

    renderRow({
        data,
        state,
    }: {
        data: PlacedItem
        state: { translateY: number }
    }): React.ReactElement {
        const { yAxis } = this
        const { entityName, label, bars, totalValue } = data

        const totalLabel = this.formatValueForLabel(totalValue)
        const showLabelInsideBar = bars.length > 1

        // We can't just take the last bar here because if the last bar has a negative value,
        // its position on the chart (valueOffset + value) might actually be leftmost rather than rightmost.
        // So we find the maximum position across all bars to determine where to place the total value label.
        const lastValue =
            _.max(bars.map((bar) => bar.point.valueOffset + bar.point.value)) ??
            0

        return (
            <g
                key={entityName}
                id={makeIdForHumanConsumption(entityName)}
                className="bar"
                transform={`translate(0, ${state.translateY ?? 0})`}
            >
                {bars.map((bar) => (
                    <StackedDiscreteBarChart.Bar
                        key={bar.seriesName}
                        entity={entityName}
                        bar={bar}
                        chartContext={this.chartContext}
                        showLabelInsideBar={showLabelInsideBar}
                        onMouseEnter={this.onEntityMouseEnter}
                        onMouseLeave={this.onEntityMouseLeave}
                    />
                ))}
                {label.renderSVG(
                    yAxis.place(this.x0) - labelToBarPadding,
                    -label.height / 2,
                    {
                        textProps: {
                            textAnchor: "end",
                            fill: "#555",
                            onMouseEnter: (): void =>
                                this.onEntityMouseEnter(label.text),
                            onMouseLeave: this.onEntityMouseLeave,
                        },
                    }
                )}
                {this.showTotalValueLabel && (
                    <text
                        transform={`translate(${
                            yAxis.place(lastValue) + labelToBarPadding
                        }, 0)`}
                        dy={dyFromAlign(VerticalAlign.middle)}
                        {...this.totalValueLabelStyle}
                    >
                        {totalLabel}
                    </text>
                )}
            </g>
        )
    }

    renderAxis(): React.ReactElement {
        const { bounds, yAxis, innerBounds } = this

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
                    // moves the zero line a little to the left to avoid
                    // overlap with the bars
                    align={HorizontalAlign.right}
                />
            </>
        )
    }

    renderLegend(): React.ReactElement | undefined {
        if (!this.showLegend) return
        return <HorizontalCategoricalColorLegend manager={this} />
    }

    renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderAxis()}
                {this.renderLegend()}
                <g id={makeIdForHumanConsumption("bars")}>
                    {this.placedItems.map((item) =>
                        this.renderRow({
                            data: item,
                            state: { translateY: item.yPosition },
                        })
                    )}
                </g>
            </>
        )
    }

    renderInteractive(): React.ReactElement {
        const { bounds } = this

        const handlePositionUpdate = (d: PlacedItem): HashMap => ({
            translateY: [d.yPosition],
            timing: { duration: 350, ease: easeQuadOut },
        })

        // needs to be referenced here, otherwise it's not updated in the renderRow function
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.focusSeriesName

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
                {this.renderAxis()}
                {this.renderLegend()}
                <NodeGroup
                    data={this.placedItems}
                    keyAccessor={(d: PlacedItem): string => d.entityName}
                    start={handlePositionUpdate}
                    update={handlePositionUpdate}
                >
                    {(nodes): React.ReactElement => (
                        <g>{nodes.map((node) => this.renderRow(node))}</g>
                    )}
                </NodeGroup>
                {this.tooltip}
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
    }): React.ReactElement {
        const { entity, bar, chartContext } = props
        const { yAxis, formatValueForLabel, focusSeriesName, barHeight } =
            chartContext

        const isFaint =
            focusSeriesName !== undefined && focusSeriesName !== bar.seriesName
        const isHover =
            chartContext.hoverSeriesName === bar.seriesName &&
            chartContext.hoverEntityName === entity
        let barX = yAxis.place(chartContext.x0 + bar.point.valueOffset)
        const barWidth = Math.abs(
            yAxis.place(bar.point.value) - yAxis.place(chartContext.x0)
        )

        // Place bars that represent negative values on the left
        if (bar.point.value < 0) barX -= barWidth

        const barLabel = formatValueForLabel(bar.point.value)
        const labelFontSize = GRAPHER_FONT_SCALE_12 * chartContext.baseFontSize
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
                id={makeIdForHumanConsumption(bar.seriesName)}
                onMouseEnter={(): void =>
                    props?.onMouseEnter(entity, bar.seriesName)
                }
                onMouseLeave={props?.onMouseLeave}
            >
                <rect
                    id={makeIdForHumanConsumption("bar")}
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
                        dy={dyFromAlign(VerticalAlign.middle)}
                    >
                        {barLabel}
                    </text>
                )}
            </g>
        )
    }

    @computed private get tooltip(): React.ReactElement | undefined {
        const {
                tooltipState: { target, position, fading },
                formatColumn: { unit, shortUnit },
                manager: { endTime: targetTime },
                inputTable: { timeColumn },
            } = this,
            item = this.placedItems.find(
                ({ entityName }) => entityName === target?.entityName
            ),
            hasNotice = item?.bars.some(
                ({ point }) => !point.fake && point.time !== targetTime
            ),
            targetNotice = hasNotice
                ? timeColumn.formatValue(targetTime)
                : undefined

        const toleranceNotice = targetNotice
            ? {
                  icon: TooltipFooterIcon.notice,
                  text: makeTooltipToleranceNotice(targetNotice),
              }
            : undefined
        const roundingNotice = this.formatColumn.roundsToSignificantFigures
            ? {
                  icon: TooltipFooterIcon.none,
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
                    subtitle={unit !== shortUnit ? unit : undefined}
                    subtitleFormat="unit"
                    footer={footer}
                    dissolve={fading}
                    dismiss={() => (this.tooltipState.target = null)}
                >
                    <TooltipTable
                        columns={[this.formatColumn]}
                        totals={[item.totalValue]}
                        rows={item.bars.map((bar) => {
                            const {
                                seriesName: name,
                                color,
                                point: { value, time, fake: blurred },
                            } = bar

                            return {
                                name,
                                swatch: { color },
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

    @computed private get yColumns(): CoreColumn[] {
        return this.chartState.yColumns
    }

    @computed private get sortColumn(): CoreColumn | undefined {
        return this.chartState.sortColumn
    }

    @computed private get series(): readonly StackedSeries<EntityName>[] {
        return this.chartState.series
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }
}
