import * as _ from "lodash-es"
import React from "react"
import {
    Bounds,
    makeFigmaId,
    exposeInstanceOnWindow,
    AxisAlign,
} from "@ourworldindata/utils"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ScaleType } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
    FontSettings,
} from "../core/GrapherConstants"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { HorizontalAxisComponent } from "../axis/AxisViews"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { HorizontalAxis } from "../axis/Axis"
import { ChartInterface } from "../chart/ChartInterface"
import {
    DumbbellChartManager,
    DumbbellChartSeries,
    DumbbellDataSeries,
    SizedDumbbellChartSeries,
    PlacedDumbbellChartSeries,
    RenderDumbbellChartSeries,
    BAR_SPACING_FACTOR,
} from "./DumbbellChartConstants"
import { DumbbellChartState } from "./DumbbellChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap"
import { enrichSeriesWithLabels } from "../barCharts/DiscreteBarChartHelpers"
import { resolveEmphasis } from "../interaction/Emphasis"
import { DumbbellChartRow } from "./DumbbellChartRow"
import { AnimatedRows } from "../animation/AnimatedRows"

const ANNOTATION_PADDING = 2

/** The gap between the entity label and the dumbbell */
const GAP__ENTITY_LABEL__DUMBBELL = 5

export type DumbbellChartProps = ChartComponentProps<DumbbellChartState>

@observer
export class DumbbellChart
    extends React.Component<DumbbellChartProps>
    implements ChartInterface, AxisManager
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
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padRight(10)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get dataSeries(): DumbbellDataSeries[] {
        return this.chartState.series
    }

    @computed private get allSeries(): DumbbellChartSeries[] {
        return this.chartState.allSeries
    }

    @computed private get seriesCount(): number {
        return this.allSeries.length
    }

    // Font settings

    @computed private get labelFontSize(): number {
        const availableHeight = this.bounds.height / this.seriesCount
        return Math.min(
            GRAPHER_FONT_SCALE_12 * this.fontSize,
            1.1 * availableHeight
        )
    }

    @computed private get entityLabelStyle(): FontSettings {
        return {
            fontSize: this.labelFontSize,
            fontWeight: 700,
            lineHeight: 1,
        }
    }

    @computed private get valueLabelStyle(): FontSettings {
        return { fontSize: this.labelFontSize, fontWeight: 400, lineHeight: 1 }
    }

    @computed private get annotationStyle(): FontSettings {
        return {
            fontSize: this.labelFontSize * 0.9,
            fontWeight: 300,
            lineHeight: 1,
        }
    }

    // Sized series (entity labels measured)

    @computed get sizedSeries(): SizedDumbbellChartSeries[] {
        return enrichSeriesWithLabels({
            series: this.allSeries,
            availableHeightPerSeries: this.bounds.height / this.seriesCount,
            minLabelWidth: 0.15 * this.bounds.width,
            maxLabelWidth: 0.4 * this.bounds.width,
            fontSettings: this.entityLabelStyle,
            annotationFontSettings: this.annotationStyle,
            showRegionTooltip: !this.manager.isStatic,
        })
    }

    // Axis

    @computed private get xDomainDefault(): [number, number] {
        return this.chartState.yDomainDefault
    }

    @computed private get xRange(): [number, number] {
        return this.innerBounds.xRange()
    }

    // NB: We use yAxisConfig for the horizontal value axis, same convention as DiscreteBar
    @computed private get xAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                singleValueAxisPointAlign: AxisAlign.start,
                ...this.manager.yAxisConfig,
            },
            this
        )
    }

    @computed get yAxis(): HorizontalAxis {
        const axis = this.xAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings(this.xDomainDefault)
        axis.scaleType = ScaleType.linear
        axis.formatColumn = this.chartState.formatColumn
        axis.range = this.xRange
        axis.label = ""
        return axis
    }

    // Layout

    @computed private get leftLabelsWidth(): number {
        const labelWidths = this.sizedSeries.map((series) => {
            const labelWidth = series.label?.width ?? 0
            const annotationWidth = series.annotationTextWrap?.width ?? 0
            return Math.max(labelWidth, annotationWidth)
        })
        return _.max(labelWidths) ?? 0
    }

    @computed private get leftValueLabelsWidth(): number {
        const widths = this.dataSeries.map(
            (series) => this.formatValue(series.start.value).width
        )
        return _.max(widths) ?? 0
    }

    @computed private get rightValueLabelsWidth(): number {
        const widths = this.dataSeries.map(
            (series) => this.formatValue(series.end.value).width
        )
        return _.max(widths) ?? 0
    }

    // Estimate axis height without depending on the full yAxis object
    // (which would create a cycle: yAxis → xRange → innerBounds → yAxis)
    @computed private get axisHeight(): number {
        return 1.5 * GRAPHER_FONT_SCALE_12 * this.fontSize
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds
            .padLeft(
                this.leftLabelsWidth +
                    GAP__ENTITY_LABEL__DUMBBELL +
                    this.leftValueLabelsWidth +
                    GAP__ENTITY_LABEL__DUMBBELL
            )
            .padRight(this.rightValueLabelsWidth + GAP__ENTITY_LABEL__DUMBBELL)
            .padBottom(this.axisHeight)
    }

    @computed private get seriesHeight(): number {
        return this.innerBounds.height / this.seriesCount
    }

    @computed private get barSpacing(): number {
        return this.seriesHeight * BAR_SPACING_FACTOR
    }

    @computed private get barHeight(): number {
        const totalWhiteSpace = this.seriesCount * this.barSpacing
        return (this.innerBounds.height - totalWhiteSpace) / this.seriesCount
    }

    @computed private get dotRadius(): number {
        return Math.min(this.barHeight * 0.35, 6)
    }

    // Data chain: placed and render series

    @computed private get placedSeries(): PlacedDumbbellChartSeries[] {
        const yOffset =
            this.innerBounds.top + this.barHeight / 2 + this.barSpacing / 2

        return this.sizedSeries.map(
            (series, index): PlacedDumbbellChartSeries => {
                const barY =
                    yOffset + index * (this.barHeight + this.barSpacing)
                const entityLabelX =
                    this.innerBounds.x -
                    GAP__ENTITY_LABEL__DUMBBELL -
                    this.leftValueLabelsWidth -
                    GAP__ENTITY_LABEL__DUMBBELL

                const annotationHeight = series.annotationTextWrap
                    ? ANNOTATION_PADDING + series.annotationTextWrap.height
                    : 0
                const totalLabelHeight = series.label.height + annotationHeight
                const entityLabelY = barY - totalLabelHeight / 2
                const annotationY = series.annotationTextWrap
                    ? entityLabelY + series.label.height + ANNOTATION_PADDING
                    : undefined

                const placement = {
                    barY,
                    entityLabelX,
                    entityLabelY,
                    annotationY,
                    label: series.label,
                    annotationTextWrap: series.annotationTextWrap,
                }

                if (series.type === "data") {
                    return {
                        ...series,
                        ...placement,
                        startX: this.yAxis.place(series.start.value),
                        endX: this.yAxis.place(series.end.value),
                    }
                }

                return { ...series, ...placement }
            }
        )
    }

    @computed private get renderSeries(): RenderDumbbellChartSeries[] {
        return this.placedSeries.map((series) => {
            if (series.type === "data") {
                const emphasis = resolveEmphasis({ focus: series.focus })
                return { ...series, emphasis }
            }
            return { ...series, emphasis: resolveEmphasis({}) }
        })
    }

    // Formatting helpers

    private formatValue(value: number): { text: string; width: number } {
        const text = this.chartState.formatColumn.formatValueShort(value)
        const width = Bounds.forText(text, this.valueLabelStyle).width
        return { text, width }
    }

    private formatValueForLabel = (value: number): string => {
        return this.chartState.formatColumn.formatValueShort(value)
    }

    // Lifecycle

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    // Rendering

    private rowProps(series: RenderDumbbellChartSeries): {
        series: RenderDumbbellChartSeries
        chartAreaLeft: number
        chartAreaRight: number
        dotRadius: number
        valueLabelStyle: FontSettings
        formatValue: (value: number) => string
    } {
        return {
            series,
            chartAreaLeft: this.innerBounds.left,
            chartAreaRight: this.innerBounds.right,
            dotRadius: this.dotRadius,
            valueLabelStyle: this.valueLabelStyle,
            formatValue: this.formatValueForLabel,
        }
    }

    private renderAxis(): React.ReactElement {
        return (
            <HorizontalAxisComponent
                bounds={this.bounds}
                axis={this.yAxis}
                preferredAxisPosition={this.innerBounds.bottom}
            />
        )
    }

    private renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderAxis()}
                <g id={makeFigmaId("series")}>
                    {this.renderSeries.map((series) => (
                        <DumbbellChartRow
                            key={series.seriesName}
                            {...this.rowProps(series)}
                            translateY={series.barY}
                        />
                    ))}
                </g>
            </>
        )
    }

    private renderInteractive(): React.ReactElement {
        return (
            <g id={makeFigmaId("dumbbell-chart")}>
                {this.renderAxis()}
                <AnimatedRows
                    items={this.renderSeries}
                    keyAccessor={(d: RenderDumbbellChartSeries): string =>
                        d.seriesName
                    }
                    getY={(d: RenderDumbbellChartSeries): number => d.barY}
                    renderRow={(series): React.ReactElement => (
                        <DumbbellChartRow
                            key={series.seriesName}
                            {...this.rowProps(series)}
                            translateY={0}
                        />
                    )}
                />
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
