import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { scalePoint, ScalePoint } from "d3-scale"
import { SeriesName, SwimlaneSegmentLabelMode } from "@ourworldindata/types"
import {
    Bounds,
    excludeUndefined,
    exposeInstanceOnWindow,
    makeFigmaId,
    HorizontalAlign,
} from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    FontSettings,
    makePatternId,
    Patterns,
} from "../core/GrapherConstants"
import { AnimatedRows } from "../animation/AnimatedRows"
import { enrichSeriesWithLabels } from "../rowSeriesLabels/RowSeriesLabelHelpers.js"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"
import {
    HorizontalAxisComponent,
    HorizontalAxisDomainLine,
    SOLID_TICK_COLOR,
} from "../axis/AxisViews"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { HorizontalAxis } from "../axis/Axis"
import { ChartInterface } from "../chart/ChartInterface"
import { roundFontSize, scaleFontSize } from "../chart/ChartUtils"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import { ChartComponentProps } from "../chart/ChartTypeMap"
import {
    CategoricalBin,
    ColorScaleBin,
    addPatternRefToBin,
    isNoDataBin,
    mergeCategoricalBinsByLabelAndColor,
} from "../color/ColorScaleBin"
import { HorizontalCategoricalColorLegend } from "../legend/HorizontalCategoricalColorLegend"
import { HorizontalCategoricalColorLegendState } from "../legend/HorizontalCategoricalColorLegendState"
import { HorizontalNumericColorLegend } from "../legend/HorizontalNumericColorLegend"
import { HorizontalNumericColorLegendState } from "../legend/HorizontalNumericColorLegendState"
import {
    ENTITY_LABEL_CHART_GAP,
    PADDING_BETWEEN_LEGEND_AND_ROWS,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
    SwimlaneChartManager,
    SwimlaneSegmentLabelStyle,
    SwimlaneSeries,
} from "./SwimlaneChartConstants"
import { SwimlaneChartState } from "./SwimlaneChartState"
import {
    computeHeightPerSeries,
    toLabelledNumericBin,
    toPlacedSwimlaneSeries,
} from "./SwimlaneChartHelpers"
import { SwimlaneRow } from "./SwimlaneRow"

export type SwimlaneChartProps = ChartComponentProps<SwimlaneChartState>

@observer
export class SwimlaneChart
    extends React.Component<SwimlaneChartProps>
    implements ChartInterface, AxisManager
{
    constructor(props: SwimlaneChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): SwimlaneChartState {
        return this.props.chartState
    }

    @computed private get manager(): SwimlaneChartManager {
        return this.chartState.manager
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get bounds(): Bounds {
        // 2px padding at the bottom prevents the tick labels from overflowing
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padBottom(2)
    }

    @computed private get showLegend(): boolean {
        return this.manager.showLegend ?? true
    }

    @computed private get noDataPatternId(): string {
        return makePatternId(
            Patterns.noDataPattern,
            this.manager.patternIdSuffix
        )
    }

    @computed private get noDataLegendBin(): CategoricalBin | undefined {
        const bin =
            this.chartState.colorScale.categoricalLegendBins.find(isNoDataBin)
        return bin && addPatternRefToBin(bin, this.noDataPatternId)
    }

    @computed private get categoryLegendBins(): CategoricalBin[] {
        return mergeCategoricalBinsByLabelAndColor(
            this.chartState.colorScale.categoricalLegendBins.filter(
                (bin) => !bin.isHidden && !isNoDataBin(bin)
            )
        )
    }

    @computed private get categoricalLegendBins(): CategoricalBin[] {
        return excludeUndefined([
            this.noDataLegendBin,
            ...this.categoryLegendBins,
        ])
    }

    @computed private get ordinalLegendBins(): ColorScaleBin[] {
        return excludeUndefined([
            this.noDataLegendBin,
            ...this.categoryLegendBins.map(toLabelledNumericBin),
        ])
    }

    @computed private get legendBinSize(): number {
        return 0.625 * this.fontSize
    }

    @computed private get ordinalLegendState():
        | HorizontalNumericColorLegendState
        | undefined {
        if (!this.showLegend || this.chartState.categoryKind !== "ordinal")
            return undefined

        return new HorizontalNumericColorLegendState(this.ordinalLegendBins, {
            baseFontSize: this.fontSize,
            maxWidth: this.bounds.width,
            align: HorizontalAlign.center,
            binSize: this.legendBinSize,
        })
    }

    @computed private get categoricalLegendState():
        | HorizontalCategoricalColorLegendState
        | undefined {
        if (!this.showLegend || this.chartState.categoryKind !== "categorical")
            return undefined

        return new HorizontalCategoricalColorLegendState(
            this.categoricalLegendBins,
            {
                baseFontSize: this.fontSize,
                width: this.bounds.width,
                align: HorizontalAlign.left,
            }
        )
    }

    @computed private get boundsWithoutLegend(): Bounds {
        const legendHeight =
            this.ordinalLegendState?.height ??
            this.categoricalLegendState?.height ??
            0

        return this.bounds.padTop(
            legendHeight > 0
                ? legendHeight + PADDING_BETWEEN_LEGEND_AND_ROWS
                : 0
        )
    }

    @computed private get series(): SwimlaneSeries[] {
        return this.chartState.series
    }

    @computed private get availableHeightPerSeries(): number {
        return computeHeightPerSeries({
            height: this.boundsWithoutLegend.height,
            rowCount: this.series.length,
        })
    }

    @computed private get entityLabelStyle(): FontSettings {
        const fontSize = roundFontSize(
            Math.min(
                scaleFontSize(12, this.fontSize),
                1.1 * this.availableHeightPerSeries
            )
        )

        return { fontSize, fontWeight: 700, lineHeight: 1 }
    }

    @computed private get shouldShowSegmentLabels(): boolean {
        return (
            this.chartState.segmentLabelMode !== SwimlaneSegmentLabelMode.None
        )
    }

    @computed private get segmentLabelStyle(): SwimlaneSegmentLabelStyle {
        const fontSize = scaleFontSize(12, this.fontSize)
        return {
            category: { fontSize, fontWeight: 700, lineHeight: 1.2 },
            timeRange: { fontSize, fontWeight: 500, lineHeight: 1.2 },
        }
    }

    @computed private get sizedSeries(): SizedSwimlaneSeries[] {
        return enrichSeriesWithLabels({
            series: this.series,
            availableHeightPerSeries: this.availableHeightPerSeries,
            minLabelWidth: 0.3 * this.boundsWithoutLegend.width,
            maxLabelWidth: 0.66 * this.boundsWithoutLegend.width,
            fontSettings: this.entityLabelStyle,
            showRegionTooltip: !this.manager.isStatic,
        })
    }

    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(
            { isDomainEndExclusive: true, ...this.manager.xAxisConfig },
            this
        )
    }

    @computed private get entityLabelMaxWidth(): number {
        const labelWidths = this.sizedSeries.map((series) => series.label.width)
        if (labelWidths.length === 0) return 0
        return Math.max(...labelWidths)
    }

    @computed get axisBounds(): Bounds {
        return this.boundsWithoutLegend.padLeft(
            this.entityLabelMaxWidth + ENTITY_LABEL_CHART_GAP
        )
    }

    @computed get xAxis(): HorizontalAxis {
        const axis = this.chartState.toHorizontalAxis(this.xAxisConfig)
        axis.range = this.axisBounds.xRange()
        return axis
    }

    @computed private get innerBounds(): Bounds {
        return this.axisBounds.padBottom(this.xAxis.height)
    }

    @computed private get heightPerSeries(): number {
        return computeHeightPerSeries({
            height: this.innerBounds.height,
            rowCount: this.series.length,
        })
    }

    @computed private get yScale(): ScalePoint<SeriesName> {
        const { innerBounds, heightPerSeries, series } = this
        const totalHeight = heightPerSeries * series.length
        return scalePoint<SeriesName>()
            .domain(series.map((s) => s.seriesName))
            .range([
                innerBounds.centerY - totalHeight / 2,
                innerBounds.centerY + totalHeight / 2,
            ])
            .padding(0.5)
    }

    @computed private get placedSeries(): PlacedSwimlaneSeries[] {
        return toPlacedSwimlaneSeries({
            series: this.sizedSeries,
            labelX: this.innerBounds.left - ENTITY_LABEL_CHART_GAP,
            heightPerSeries: this.heightPerSeries,
            placeSeries: (seriesName) => this.yScale(seriesName)!,
            placeTime: (time) => this.xAxis.place(time),
            shouldShowSegmentLabels: this.shouldShowSegmentLabels,
            segmentLabelStyle: this.segmentLabelStyle,
        })
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    private renderLegend(): React.ReactElement | undefined {
        if (this.ordinalLegendState)
            return (
                <HorizontalNumericColorLegend
                    state={this.ordinalLegendState}
                    x={this.bounds.x}
                    y={this.bounds.top}
                    interactive={false}
                />
            )
        if (this.categoricalLegendState)
            return (
                <HorizontalCategoricalColorLegend
                    state={this.categoricalLegendState}
                    x={this.bounds.x}
                    y={this.bounds.top}
                    interactive={false}
                />
            )
        return undefined
    }

    private renderRows(): React.ReactElement[] {
        return this.placedSeries.map((series) => (
            <SwimlaneRow
                key={series.seriesName}
                series={series}
                y={series.y}
                noDataPatternId={this.noDataPatternId}
            />
        ))
    }

    private renderAnimatedRows(): React.ReactElement {
        return (
            <AnimatedRows
                items={this.placedSeries}
                keyAccessor={(series: PlacedSwimlaneSeries): string =>
                    series.seriesName
                }
                getY={(series: PlacedSwimlaneSeries): number => series.y}
                immediate={this.manager.disableChartRowAnimation}
                renderRow={(series): React.ReactElement => (
                    <SwimlaneRow
                        key={series.seriesName}
                        series={series}
                        y={0}
                        noDataPatternId={this.noDataPatternId}
                    />
                )}
            />
        )
    }

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataMessage
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return (
            <g>
                {this.renderLegend()}
                <HorizontalAxisComponent
                    bounds={this.boundsWithoutLegend}
                    axis={this.xAxis}
                    tickColor={GRAPHER_LIGHT_TEXT}
                    showTickMarks={true}
                    preferredAxisPosition={this.innerBounds.bottom}
                />
                <HorizontalAxisDomainLine
                    bounds={this.innerBounds}
                    stroke={SOLID_TICK_COLOR}
                />
                <g id={makeFigmaId("rows")}>
                    {this.manager.isStatic
                        ? this.renderRows()
                        : this.renderAnimatedRows()}
                </g>
            </g>
        )
    }
}
