import * as _ from "lodash-es"
import React from "react"
import {
    Bounds,
    excludeUndefined,
    numberMagnitude,
    Time,
    HorizontalAlign,
    EntityName,
    makeIdForHumanConsumption,
    dyFromAlign,
    exposeInstanceOnWindow,
    bind,
} from "@ourworldindata/utils"
import { action, computed, makeObservable } from "mobx"
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
import { AxisConfig } from "../axis/AxisConfig"
import { ChartInterface } from "../chart/ChartInterface"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import { ChartManager } from "../chart/ChartManager"
import { TooltipFooterIcon } from "../tooltip/TooltipProps.js"
import {
    Tooltip,
    TooltipState,
    TooltipTable,
    makeTooltipRoundingNotice,
    makeTooltipToleranceNotice,
} from "../tooltip/Tooltip"
import {
    Bar,
    PlacedItem,
    SizedItem,
    StackedPoint,
    StackedSeries,
} from "./StackedConstants"
import { isDarkColor } from "../color/ColorUtils"
import { HorizontalAxis } from "../axis/Axis"
import { HashMap, NodeGroup } from "react-move"
import { easeQuadOut } from "d3-ease"
import { TextWrap } from "@ourworldindata/components"
import { StackedDiscreteBarChartState } from "./StackedDiscreteBarChartState"

// if an entity name exceeds this width, we use the short name instead (if available)
const SOFT_MAX_LABEL_WIDTH = 90

const BAR_SPACING_FACTOR = 0.35

const labelToBarPadding = 5

export interface StackedDiscreteBarChartManager extends ChartManager {
    endTime?: Time
    hideTotalValueLabel?: boolean
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

interface StackedDiscreteBarsProps {
    chartState: StackedDiscreteBarChartState
    bounds?: Bounds
    tooltipState?: TooltipState<{
        entityName: string
        seriesName?: string
    }>
    focusSeriesName?: SeriesName
}

@observer
export class StackedDiscreteBars
    extends React.Component<StackedDiscreteBarsProps>
    implements ChartInterface
{
    base = React.createRef<SVGGElement>()

    constructor(props: StackedDiscreteBarsProps) {
        super(props)

        makeObservable(this)
    }

    @computed get chartState(): StackedDiscreteBarChartState {
        return this.props.chartState
    }

    @computed private get manager(): StackedDiscreteBarChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get focusSeriesName(): SeriesName | undefined {
        return this.props.focusSeriesName
    }

    @computed private get tooltipState(): TooltipState<{
        entityName: string
        seriesName?: string
    }> {
        return (
            this.props.tooltipState ??
            new TooltipState<{
                entityName: string
                seriesName?: string
            }>()
        )
    }

    @computed private get baseFontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed private get barCount(): number {
        return this.chartState.items.length
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

    @computed private get innerBounds(): Bounds {
        return this.bounds
            .padLeft(this.labelWidth)
            .padBottom(this.showHorizontalAxis ? this.yAxis.height : 0)
            .padRight(this.totalValueLabelWidth)
    }

    @computed private get sizedItems(): readonly SizedItem[] {
        // can't use `this.barHeight` due to a circular dependency
        const barHeight = this.approximateBarHeight

        return this.chartState.sortedItems.map((item) => {
            // make sure we're dealing with a single-line text fragment
            const entityName = item.entityName.replace(/\n/g, " ").trim()

            const maxLegendWidth = 0.3 * this.bounds.width

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

    @computed private get placedItems(): PlacedItem[] {
        const { innerBounds, barHeight, barSpacing } = this

        const topYOffset = innerBounds.top + barHeight / 2 + barSpacing / 2

        return this.sizedItems.map((d, i) => ({
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
        const { height } = this.bounds
        const approximateMaxBarHeight = height / this.barCount
        const approximateBarSpacing =
            approximateMaxBarHeight * BAR_SPACING_FACTOR
        const totalWhiteSpace = this.barCount * approximateBarSpacing
        return (height - totalWhiteSpace) / this.barCount
    }

    @computed get fontSize(): number {
        return this.baseFontSize
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

    @action.bound private onEntityMouseEnter(
        entityName: string,
        seriesName?: string
    ): void {
        this.tooltipState.target = { entityName, seriesName }
    }

    @action.bound private onEntityMouseLeave(): void {
        this.tooltipState.target = null
    }

    override render(): React.ReactElement {
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
                    <StackedDiscreteBars.Bar
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

    renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderAxis()}
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
        const handlePositionUpdate = (d: PlacedItem): HashMap => ({
            translateY: [d.yPosition],
            timing: { duration: 350, ease: easeQuadOut },
        })

        // needs to be referenced here, otherwise it's not updated in the renderRow function
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.focusSeriesName

        return (
            <>
                {this.renderAxis()}
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
            </>
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

    @computed private get series(): readonly StackedSeries<EntityName>[] {
        return this.chartState.series
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }
}
