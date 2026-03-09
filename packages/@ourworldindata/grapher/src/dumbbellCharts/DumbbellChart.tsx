import * as _ from "lodash-es"
import React from "react"
import {
    Bounds,
    makeFigmaId,
    dyFromAlign,
    exposeInstanceOnWindow,
    AxisAlign,
} from "@ourworldindata/utils"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ScaleType, VerticalAlign } from "@ourworldindata/types"
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
    RenderDumbbellDataSeries,
    DUMBBELL_STYLE,
    BAR_SPACING_FACTOR,
} from "./DumbbellChartConstants"
import { DumbbellChartState } from "./DumbbellChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap"
import { enrichSeriesWithLabels } from "../barCharts/DiscreteBarChartHelpers"
import { SeriesLabel } from "../seriesLabel/SeriesLabel"
import { resolveEmphasis } from "../interaction/Emphasis"
import { GRAPHER_DARK_TEXT } from "../color/ColorConstants"
import { Dumbbell } from "./Dumbbell"

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

    // Lifecycle

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    // Rendering

    private renderEntityLabel(
        series: RenderDumbbellChartSeries
    ): React.ReactElement | null {
        if (!series.label) return null

        return (
            <SeriesLabel
                key={`label-${series.seriesName}`}
                state={series.label}
                x={series.entityLabelX}
                y={series.entityLabelY}
                opacity={DUMBBELL_STYLE[series.emphasis].labelOpacity}
            />
        )
    }

    private renderEntityAnnotation(
        series: RenderDumbbellChartSeries
    ): React.ReactElement | null {
        if (!series.annotationTextWrap || series.annotationY === undefined)
            return null

        return (
            <g key={`annotation-${series.seriesName}`}>
                {series.annotationTextWrap.renderSVG(
                    series.entityLabelX,
                    series.annotationY,
                    {
                        textProps: {
                            fill: "#333",
                            textAnchor: "end",
                            opacity:
                                DUMBBELL_STYLE[series.emphasis].labelOpacity,
                        },
                    }
                )}
            </g>
        )
    }

    private renderStartValueLabel(
        series: RenderDumbbellDataSeries
    ): React.ReactElement {
        const { text } = this.formatValue(series.start.value)
        const minX = Math.min(series.startX, series.endX)
        return (
            <text
                key={`start-value-${series.seriesName}`}
                x={minX - GAP__ENTITY_LABEL__DUMBBELL}
                y={series.barY}
                fill={GRAPHER_DARK_TEXT}
                dy={dyFromAlign(VerticalAlign.middle)}
                textAnchor="end"
                opacity={DUMBBELL_STYLE[series.emphasis].labelOpacity}
                fontSize={this.valueLabelStyle.fontSize}
                fontWeight={this.valueLabelStyle.fontWeight}
            >
                {text}
            </text>
        )
    }

    private renderEndValueLabel(
        series: RenderDumbbellDataSeries
    ): React.ReactElement {
        const { text } = this.formatValue(series.end.value)
        const maxX = Math.max(series.startX, series.endX)
        return (
            <text
                key={`end-value-${series.seriesName}`}
                x={maxX + GAP__ENTITY_LABEL__DUMBBELL}
                y={series.barY}
                fill={GRAPHER_DARK_TEXT}
                dy={dyFromAlign(VerticalAlign.middle)}
                textAnchor="start"
                opacity={DUMBBELL_STYLE[series.emphasis].labelOpacity}
                fontSize={this.valueLabelStyle.fontSize}
                fontWeight={this.valueLabelStyle.fontWeight}
            >
                {text}
            </text>
        )
    }

    private renderDataSeries(
        series: RenderDumbbellDataSeries
    ): React.ReactElement {
        return (
            <React.Fragment key={`data-${series.seriesName}`}>
                <Dumbbell
                    series={series}
                    chartAreaLeft={this.innerBounds.left}
                    chartAreaRight={this.innerBounds.right}
                    dotRadius={this.dotRadius}
                />
                {this.renderStartValueLabel(series)}
                {this.renderEndValueLabel(series)}
            </React.Fragment>
        )
    }

    private renderNoDataSeries(
        series: RenderDumbbellChartSeries
    ): React.ReactElement {
        return (
            <g key={`no-data-${series.seriesName}`}>
                {/* Gray background line */}
                <line
                    x1={this.innerBounds.left}
                    y1={series.barY}
                    x2={this.innerBounds.right}
                    y2={series.barY}
                    stroke="#eee"
                    strokeWidth={1}
                />
                {/* "No data" label */}
                <text
                    x={(this.innerBounds.left + this.innerBounds.right) / 2}
                    y={series.barY}
                    dy={dyFromAlign(VerticalAlign.middle)}
                    textAnchor="middle"
                    fontSize={this.valueLabelStyle.fontSize}
                    fontWeight={this.valueLabelStyle.fontWeight}
                    fill="#999"
                    fontStyle="italic"
                >
                    No data
                </text>
            </g>
        )
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

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        const allSeries = this.renderSeries
        const hasAnnotations = allSeries.some(
            (series) =>
                series.annotationTextWrap && series.annotationY !== undefined
        )

        return (
            <g id={makeFigmaId("dumbbell-chart")}>
                {this.renderAxis()}
                <g id={makeFigmaId("series")}>
                    {allSeries.map((series) =>
                        series.type === "data"
                            ? this.renderDataSeries(series)
                            : this.renderNoDataSeries(series)
                    )}
                </g>
                <g id={makeFigmaId("entity-labels")}>
                    {allSeries.map((series) => this.renderEntityLabel(series))}
                </g>
                {hasAnnotations && (
                    <g id={makeFigmaId("entity-annotations")}>
                        {allSeries.map((series) =>
                            this.renderEntityAnnotation(series)
                        )}
                    </g>
                )}
            </g>
        )
    }
}
