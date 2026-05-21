import * as _ from "lodash-es"
import { scalePoint } from "d3-scale"
import React from "react"
import { match } from "ts-pattern"
import {
    Bounds,
    HorizontalAlign,
    makeFigmaId,
    exposeInstanceOnWindow,
    ScaleType,
    SeriesStrategy,
    formatValue,
    Pair,
} from "@ourworldindata/utils"
import {
    DumbbellValueLabelMode,
    TickFormattingOptions,
} from "@ourworldindata/types"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
    FontSettings,
} from "../core/GrapherConstants"
import {
    enrichSeriesWithLabels,
    computeCenteredLabelYPositions,
} from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import { NoDataModal } from "../noDataModal/NoDataModal"
import {
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
    HorizontalAxisZeroLine,
} from "../axis/AxisViews"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { HorizontalAxis } from "../axis/Axis"
import { ChartInterface } from "../chart/ChartInterface"
import {
    DumbbellChartManager,
    DumbbellSeries,
    SizedDumbbellSeries,
    PlacedDumbbellSeries,
    RenderDumbbellSeries,
    VALUE_LABEL_DOT_GAP,
    ENTITY_LABEL_CHART_GAP,
    DumbbellValueLabel,
    TOP_LEGEND_BOTTOM_PADDING,
    START_COLUMN_COLOR,
    END_COLUMN_COLOR,
    LegendLabel,
    PlacedDumbbellHead,
    MIN_LEGEND_LABEL_GAP,
} from "./DumbbellChartConstants"
import { DumbbellChartState } from "./DumbbellChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap"
import { resolveEmphasis } from "../interaction/Emphasis"
import { DumbbellChartRow } from "./DumbbellChartRow"
import {
    AxisLayout,
    calculateAxisLayout,
    computePercentChange,
} from "./DumbbellChartHelpers"
import { AnimatedRows } from "../animation/AnimatedRows"
import { roundFontSize, textWidth } from "../chart/ChartUtils.js"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import { HorizontalLabelPair } from "../horizontalLabelPair/HorizontalLabelPair.js"
import { HorizontalLabelPairState } from "../horizontalLabelPair/HorizontalLabelPairState.js"
import { InitialHorizontalLabel } from "../horizontalLabelPair/HorizontalLabelPairTypes.js"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../legend/HorizontalColorLegends.js"
import { CategoricalBin } from "../color/ColorScaleBin.js"

export type DumbbellChartProps = ChartComponentProps<DumbbellChartState>

@observer
export class DumbbellChart
    extends React.Component<DumbbellChartProps>
    implements ChartInterface, AxisManager, HorizontalColorLegendManager
{
    constructor(props: DumbbellChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): DumbbellChartState {
        return this.props.chartState
    }

    @computed private get manager(): DumbbellChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        // 2px padding at the bottom prevents the tick labels from overflowing
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padBottom(2)
    }

    @computed private get boundsWithoutLegend(): Bounds {
        return this.bounds.padTop(this.topLegendHeightWithPadding)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get series(): DumbbellSeries[] {
        return this.chartState.series
    }

    @computed private get availableHeightPerSeries(): number {
        return this.boundsWithoutLegend.height / this.series.length
    }

    @computed private get entityLabelStyle(): FontSettings {
        // Slightly overestimates the height available for a series
        // because `bounds` is used instead of `boundsWithoutLegend`
        // due to a circular dependency
        const availableHeightPerSeries = this.bounds.height / this.series.length

        const fontSize = roundFontSize(
            Math.min(
                GRAPHER_FONT_SCALE_12 * this.fontSize,
                availableHeightPerSeries
            )
        )

        return { fontSize, fontWeight: 400, lineHeight: 1 }
    }

    @computed private get valueLabelStyle(): FontSettings {
        const fontSize = this.entityLabelStyle.fontSize - 0.5

        return { fontSize, fontWeight: 400, lineHeight: 1 }
    }

    @computed private get pairLegendLabelStyle(): FontSettings {
        return {
            fontSize: this.valueLabelStyle.fontSize,
            fontWeight: 700,
            lineHeight: 1,
        }
    }

    private buildValueLabel(text: string): DumbbellValueLabel {
        return {
            text,
            width: textWidth(text, this.valueLabelStyle),
            padding: this.chartState.isEntityStrategy
                ? VALUE_LABEL_DOT_GAP
                : VALUE_LABEL_DOT_GAP + this.dumbbellHeadRadius,
        }
    }

    private getValueLabels(
        startValue: number,
        endValue: number
    ): { start?: string; end?: string } {
        return match(this.chartState.valueLabelMode)
            .with(DumbbellValueLabelMode.Absolute, () => {
                // Only show one label if the values are the same
                if (
                    this.chartState.isEntityStrategy &&
                    startValue === endValue
                ) {
                    return { start: this.formatValue(startValue) }
                }

                return {
                    start: this.formatValue(startValue),
                    end: this.formatValue(endValue),
                }
            })
            .with(DumbbellValueLabelMode.Change, () => {
                const diff = endValue - startValue
                return { end: this.formatValue(diff, { showPlus: true }) }
            })
            .with(DumbbellValueLabelMode.PercentChange, () => {
                const change = computePercentChange(startValue, endValue)
                if (change === undefined) return {}
                return {
                    end: formatValue(change, {
                        showPlus: true,
                        unit: "%",
                        numDecimalPlaces: 1,
                    }),
                }
            })
            .with(DumbbellValueLabelMode.None, () => ({}))
            .exhaustive()
    }

    @computed get sizedSeries(): SizedDumbbellSeries[] {
        return enrichSeriesWithLabels({
            series: this.series,
            availableHeightPerSeries: this.availableHeightPerSeries,
            minLabelWidth: 0.3 * this.bounds.width,
            maxLabelWidth: 0.66 * this.bounds.width,
            fontSettings: this.entityLabelStyle,
            showRegionTooltip: !this.manager.isStatic,
        }).map((series) => {
            const { start, end } = this.getValueLabels(
                series.start.value,
                series.end.value
            )

            const startLabel = start ? this.buildValueLabel(start) : undefined
            const endLabel = end ? this.buildValueLabel(end) : undefined

            return {
                ...series,
                start: {
                    ...series.start,
                    label: startLabel,
                    radius: this.dumbbellHeadRadius,
                },
                end: {
                    ...series.end,
                    label: endLabel,
                    radius: this.dumbbellHeadRadius,
                },
            }
        })
    }

    @computed private get xRange(): [number, number] {
        return this.dataBounds.xRange()
    }

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                ...this.manager.yAxisConfig,
                hideGridlines: false,
                shouldOffsetTickLabelAtStart: false,
            },
            this
        )
    }

    private toHorizontalAxis(args?: { skipRange: boolean }): HorizontalAxis {
        const axis = this.yAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.axisLayout.domain)
        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.chartState.formatColumn
        if (!args?.skipRange) axis.range = this.xRange
        axis.label = ""
        return axis
    }

    @computed get axisHeight(): number {
        // We can't use this.axis due to a circular dependency
        return this.toHorizontalAxis({ skipRange: true }).height
    }

    @computed get axis(): HorizontalAxis {
        return this.toHorizontalAxis()
    }

    @computed private get verticalScale() {
        return scalePoint<string>()
            .domain(this.series.map((s) => s.seriesName))
            .range(this.innerBounds.yRange())
            .padding(0.5)
    }

    /**
     * Ensures every row's value labels fit inside the chart area by adjusting
     * the axis domain and/or adding padding
     */
    @computed private get axisLayout(): AxisLayout {
        const [configMin, configMax] = this.yAxisConfig.domain

        const axis = this.yAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.chartState.yDomainDefault)

        return calculateAxisLayout({
            series: this.sizedSeries,
            domain: axis.domain,
            width: this.axisBounds.width,
            minFixed: Number.isFinite(configMin),
            maxFixed: Number.isFinite(configMax),
        })
    }

    @computed private get entityLabelMaxWidth(): number {
        const labelsWidths = this.sizedSeries.flatMap((series) => [
            series.label?.width ?? 0,
            series.annotationTextWrap?.width ?? 0,
        ])
        if (labelsWidths.length === 0) return 0
        return Math.max(...labelsWidths)
    }

    /** Bounds minus entity labels */
    @computed get axisBounds(): Bounds {
        return this.boundsWithoutLegend.padLeft(
            this.entityLabelMaxWidth + ENTITY_LABEL_CHART_GAP
        )
    }

    @computed private get innerBounds(): Bounds {
        return this.axisBounds.padBottom(this.axisHeight)
    }

    /** Bounds for plotting data points */
    @computed private get dataBounds(): Bounds {
        return this.innerBounds.pad(this.axisLayout.pad)
    }

    @computed private get dumbbellHeadRadius(): number {
        return this.chartState.seriesStrategy === SeriesStrategy.entity
            ? _.clamp(Math.floor(this.availableHeightPerSeries / 2), 2, 4)
            : _.clamp(Math.floor(this.availableHeightPerSeries / 2), 2, 6.5)
    }

    @computed private get placedSeries(): PlacedDumbbellSeries[] {
        return this.sizedSeries
            .map((series) => {
                const centerY = this.verticalScale(series.seriesName)
                const labelX = this.innerBounds.x - ENTITY_LABEL_CHART_GAP

                if (centerY === undefined) return undefined

                const { labelY, annotationY } = computeCenteredLabelYPositions({
                    y: centerY,
                    label: series.label,
                    annotation: series.annotationTextWrap,
                })

                const labelPosition = { x: labelX, yOffset: labelY - centerY }
                const annotationPosition =
                    annotationY !== undefined
                        ? { x: labelX, yOffset: annotationY - centerY }
                        : undefined

                return {
                    ...series,
                    y: centerY,
                    labelPosition,
                    annotationPosition,
                    start: {
                        ...series.start,
                        x: this.axis.place(series.start.value),
                    },
                    end: {
                        ...series.end,
                        x: this.axis.place(series.end.value),
                    },
                }
            })
            .filter((series) => series !== undefined)
    }

    @computed private get renderSeries(): RenderDumbbellSeries[] {
        return this.placedSeries.map((series) => {
            const emphasis = resolveEmphasis({ focus: series.focus })
            return { ...series, emphasis }
        })
    }

    @computed get legendLabels():
        | { start: LegendLabel; end: LegendLabel }
        | undefined {
        const { showLegend = true } = this.manager

        if (!showLegend || this.series.length === 0) return undefined

        return match(this.chartState.seriesStrategy)
            .with(SeriesStrategy.entity, () => {
                const { formatColumn, startTime, endTime } = this.chartState
                return {
                    start: {
                        text: formatColumn.formatTime(startTime),
                        color: GRAPHER_LIGHT_TEXT,
                        textAnchor: "center",
                    } satisfies LegendLabel,
                    end: {
                        text: formatColumn.formatTime(endTime),
                        color: GRAPHER_LIGHT_TEXT,
                        textAnchor: "center",
                    } satisfies LegendLabel,
                }
            })
            .with(SeriesStrategy.column, () => {
                const [startColumn, endColumn] = this.chartState.yColumns
                if (!startColumn || !endColumn) return undefined
                return {
                    start: {
                        text: startColumn.nonEmptyDisplayName,
                        color: START_COLUMN_COLOR,
                        textAnchor: "outward",
                    } satisfies LegendLabel,
                    end: {
                        text: endColumn.nonEmptyDisplayName,
                        color: END_COLUMN_COLOR,
                        textAnchor: "outward",
                    } satisfies LegendLabel,
                }
            })
            .exhaustive()
    }

    @computed private get topLegendHeight(): number {
        if (this.shouldShowCategoricalLegend)
            return this.categoricalLegend.height

        if (this.shouldShowPairLegend)
            // The pair legend doesn't linebreak
            return (
                this.pairLegendLabelStyle.fontSize *
                this.pairLegendLabelStyle.lineHeight
            )

        return 0
    }

    @computed private get topLegendHeightWithPadding(): number {
        return this.topLegendHeight
            ? this.topLegendHeight + TOP_LEGEND_BOTTOM_PADDING
            : 0
    }

    @computed private get pairLegendSeries():
        | Pair<InitialHorizontalLabel>
        | undefined {
        if (!this.legendLabels) return undefined

        const labels = this.legendLabels
        const sortedSeries = _.sortBy(this.placedSeries, (series) => series.y)

        // Find the top-most series that has a visible change
        const topSeries =
            sortedSeries.find((s) => s.start.x !== s.end.x) ?? sortedSeries[0]

        if (!labels || !topSeries) return undefined

        const resolveTextAnchor = (
            label: LegendLabel,
            head: PlacedDumbbellHead,
            otherHead: PlacedDumbbellHead
        ): HorizontalAlign => {
            if (label.textAnchor === "center") return HorizontalAlign.center
            const startIsLeft = head.x <= otherHead.x
            return startIsLeft ? HorizontalAlign.right : HorizontalAlign.left
        }

        return [
            {
                text: labels.start.text,
                x: topSeries.start.x,
                color: labels.start.color,
                textAnchor: resolveTextAnchor(
                    labels.start,
                    topSeries.start,
                    topSeries.end
                ),
            },
            {
                text: labels.end.text,
                x: topSeries.end.x,
                color: labels.end.color,
                textAnchor: resolveTextAnchor(
                    labels.end,
                    topSeries.end,
                    topSeries.start
                ),
            },
        ]
    }

    @computed private get pairLegendState():
        | HorizontalLabelPairState
        | undefined {
        if (!this.pairLegendSeries) return undefined

        return new HorizontalLabelPairState(this.pairLegendSeries, {
            xRange: [this.bounds.left, this.bounds.right],
            fontSettings: this.pairLegendLabelStyle,
            minGap: MIN_LEGEND_LABEL_GAP,
        })
    }

    // HorizontalColorLegendManager

    @computed get legendX(): number {
        return this.bounds.left
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

    @computed get categoricalLegendData(): CategoricalBin[] {
        if (!this.legendLabels) return []
        const { start, end } = this.legendLabels
        return [
            new CategoricalBin({
                index: 0,
                value: start.text,
                label: start.text,
                color: start.color,
            }),
            new CategoricalBin({
                index: 1,
                value: end.text,
                label: end.text,
                color: end.color,
            }),
        ]
    }

    /**
     * Whether the pair legend labels can fit side by side. Note that we
     * can't use `pairLegendState.hasOverlap` here due to a circular dependency.
     */
    @computed private get pairLegendFits(): boolean {
        if (!this.legendLabels) return false
        const { start, end } = this.legendLabels
        const labelWidths =
            textWidth(start.text, this.pairLegendLabelStyle) +
            textWidth(end.text, this.pairLegendLabelStyle)
        return labelWidths + MIN_LEGEND_LABEL_GAP <= this.bounds.width
    }

    @computed private get shouldShowPairLegend(): boolean {
        return this.pairLegendFits && !!this.pairLegendState
    }

    @computed private get shouldShowCategoricalLegend(): boolean {
        // In column mode, fall back to a categorical legend when the pair
        // labels don't fit. In entity mode, no legend is shown in that case.
        return (
            !!this.legendLabels &&
            !this.pairLegendFits &&
            this.chartState.seriesStrategy === SeriesStrategy.column
        )
    }

    @computed
    private get categoricalLegend(): HorizontalCategoricalColorLegend {
        return new HorizontalCategoricalColorLegend({ manager: this })
    }

    private formatValue(
        value: number,
        options?: TickFormattingOptions
    ): string {
        return this.chartState.formatColumn.formatValueShort(value, options)
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    private renderLegend(): React.ReactElement | null {
        if (this.shouldShowCategoricalLegend)
            return <HorizontalCategoricalColorLegend manager={this} />
        if (this.shouldShowPairLegend && this.pairLegendState)
            return (
                <HorizontalLabelPair
                    state={this.pairLegendState}
                    y={this.bounds.top}
                />
            )
        return null
    }

    private renderStatic(): React.ReactElement {
        return (
            <>
                <DumbbellChartAxis
                    bounds={this.boundsWithoutLegend}
                    dataBounds={this.dataBounds}
                    axis={this.axis}
                />
                <g id={makeFigmaId("rows")}>
                    {this.renderSeries.map((series) => (
                        <DumbbellChartRow
                            key={series.seriesName}
                            series={series}
                            seriesStrategy={this.chartState.seriesStrategy}
                            connectorStyle={this.chartState.connectorStyle}
                            range={this.xRange}
                            valueLabelStyle={this.valueLabelStyle}
                            y={series.y}
                        />
                    ))}
                </g>
                {this.renderLegend()}
            </>
        )
    }

    private renderInteractive(): React.ReactElement {
        const { xRange, valueLabelStyle } = this
        const { seriesStrategy, connectorStyle } = this.chartState

        return (
            <g>
                <DumbbellChartAxis
                    bounds={this.boundsWithoutLegend}
                    dataBounds={this.dataBounds}
                    axis={this.axis}
                />
                <AnimatedRows
                    items={this.renderSeries}
                    keyAccessor={(d: RenderDumbbellSeries): string =>
                        d.seriesName
                    }
                    getY={(d: RenderDumbbellSeries): number => d.y}
                    renderRow={(series): React.ReactElement => (
                        <DumbbellChartRow
                            key={series.seriesName}
                            series={series}
                            seriesStrategy={seriesStrategy}
                            connectorStyle={connectorStyle}
                            range={xRange}
                            valueLabelStyle={valueLabelStyle}
                            y={0}
                        />
                    )}
                />
                {this.renderLegend()}
            </g>
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
}

function DumbbellChartAxis({
    axis,
    bounds,
    dataBounds,
}: {
    axis: HorizontalAxis
    bounds: Bounds
    dataBounds: Bounds
}): React.ReactElement {
    return (
        <>
            <HorizontalAxisComponent
                bounds={bounds}
                axis={axis}
                tickColor={GRAPHER_LIGHT_TEXT}
            />
            <HorizontalAxisGridLines bounds={dataBounds} axis={axis} />
            {axis.contains(0) && (
                <HorizontalAxisZeroLine
                    bounds={dataBounds}
                    axis={axis}
                    color="#999"
                />
            )}
        </>
    )
}
