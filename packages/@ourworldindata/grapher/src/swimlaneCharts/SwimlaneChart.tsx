import * as _ from "lodash-es"
import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    exposeInstanceOnWindow,
    makeFigmaId,
    HorizontalAlign,
} from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    FontSettings,
    Patterns,
} from "../core/GrapherConstants"
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
    NumericBin,
    addPatternRefToBin,
    isNoDataBin,
} from "../color/ColorScaleBin"
import { HorizontalCategoricalColorLegend } from "../legend/HorizontalCategoricalColorLegend"
import { HorizontalCategoricalColorLegendState } from "../legend/HorizontalCategoricalColorLegendState"
import { HorizontalNumericColorLegend } from "../legend/HorizontalNumericColorLegend"
import { HorizontalNumericColorLegendState } from "../legend/HorizontalNumericColorLegendState"
import { ExternalColorLegendData } from "../legend/HorizontalColorLegendTypes"
import {
    ENTITY_LABEL_CHART_GAP,
    PADDING_BETWEEN_LEGEND_AND_LANES,
    PlacedSwimlaneSeries,
    SizedSwimlaneSeries,
    SwimlaneChartManager,
    SwimlaneSeries,
    TICK_LABEL_OVERFLOW_PADDING,
} from "./SwimlaneChartConstants"
import { SwimlaneChartState } from "./SwimlaneChartState"
import { toPlacedSwimlaneSeries } from "./SwimlaneChartHelpers"
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

    @computed private get showLegend(): boolean {
        return this.manager.showLegend ?? true
    }

    @computed private get categoricalLegendBins(): CategoricalBin[] {
        const [noData, categories] = _.partition(
            this.chartState.colorScale.categoricalLegendBins,
            (bin) => isNoDataBin(bin)
        )
        return [
            ...noData.map((bin) =>
                addPatternRefToBin(bin, Patterns.noDataPattern)
            ),
            ...categories,
        ]
    }

    @computed private get ordinalLegendBins(): ColorScaleBin[] {
        const [noData, categories] = _.partition(
            this.categoricalLegendBins,
            (bin) => isNoDataBin(bin)
        )
        // A NumericBin has no isHidden, so drop hidden categories before converting
        return [
            ...noData,
            ...categories
                .filter((bin) => !bin.isHidden)
                .map(toLabelledNumericBin),
        ]
    }

    @computed private get legendBinSize(): number {
        return 0.625 * this.fontSize
    }

    @computed private get ordinalLegendState():
        | HorizontalNumericColorLegendState
        | undefined {
        if (!this.showLegend || this.chartState.categories?.kind !== "ordinal")
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
        if (
            !this.showLegend ||
            this.chartState.categories?.kind !== "categorical"
        )
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

        return legendHeight > 0
            ? this.bounds.padTop(
                  legendHeight + PADDING_BETWEEN_LEGEND_AND_LANES
              )
            : this.bounds
    }

    @computed get externalLegend(): ExternalColorLegendData | undefined {
        if (this.showLegend) return undefined

        return this.chartState.categories?.kind === "ordinal"
            ? {
                  numericLegendData: this.ordinalLegendBins,
                  numericBinSize: this.legendBinSize,
              }
            : { categoricalLegendData: this.categoricalLegendBins }
    }

    @computed private get series(): SwimlaneSeries[] {
        return this.chartState.series
    }

    @computed private get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padBottom(
            TICK_LABEL_OVERFLOW_PADDING
        )
    }

    @computed private get availableHeightPerSeries(): number {
        return this.boundsWithoutLegend.height / this.series.length
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
        return new AxisConfig(this.manager.xAxisConfig, this)
    }

    @computed private get entityLabelMaxWidth(): number {
        const labelWidths = this.sizedSeries.map((series) => series.label.width)
        if (labelWidths.length === 0) return 0
        return Math.max(...labelWidths)
    }

    /** Bounds minus the entity labels; also this chart's `AxisManager` contribution */
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

    @computed private get placedSeries(): PlacedSwimlaneSeries[] {
        return toPlacedSwimlaneSeries({
            series: this.sizedSeries,
            bounds: this.innerBounds,
            placeTime: (time) => this.xAxis.place(time),
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
                <g id={makeFigmaId("lanes")}>
                    {this.placedSeries.map((series) => (
                        <SwimlaneRow key={series.seriesName} series={series} />
                    ))}
                </g>
            </g>
        )
    }
}

function toLabelledNumericBin(bin: CategoricalBin, index: number): NumericBin {
    return new NumericBin({
        isFirst: index === 0,
        isOpenLeft: false,
        isOpenRight: false,
        min: index,
        max: index + 1,
        displayMin: "",
        displayMax: "",
        label: bin.text,
        color: bin.color,
    })
}
