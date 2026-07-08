import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import * as _ from "lodash-es"
import { scaleLinear } from "d3-scale"
import {
    Bounds,
    SeriesName,
    VerticalAlign,
    dyFromAlign,
} from "@ourworldindata/utils"
import { SideWidths } from "@ourworldindata/types"
import { ChartInterface } from "../chart/ChartInterface"
import { LineChartState } from "./LineChartState"
import { LineChartProps } from "./LineChart.js"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import {
    CATEGORICAL_LEGEND_STYLE,
    LineChartManager,
    LineChartSeries,
    LinePoint,
    NUMERIC_LEGEND_STYLE,
    PlacedLineChartSeries,
    PlacedPoint,
    RenderLineChartSeries,
} from "./LineChartConstants"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    FontSettings,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { Lines } from "./Lines"
import {
    getYAxisConfigDefaults,
    toPlacedLineChartSeries,
    toRenderLineChartSeries,
} from "./LineChartHelpers"
import {
    HorizontalAxisComponent,
    VerticalAxisDomainLine,
    VerticalAxisZeroLine,
} from "../axis/AxisViews"
import { InitialAnchoredLabelSeries } from "../anchoredLabels/AnchoredLabelsTypes"
import { AnchoredLabelsState } from "../anchoredLabels/AnchoredLabelsState"
import { AnchoredLabels } from "../anchoredLabels/AnchoredLabels"
import { darkenColorForLine } from "../color/ColorUtils.js"
import { GRAPHER_LIGHT_TEXT } from "../color/ColorConstants.js"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"
import { HorizontalColorLegendManager } from "../legend/HorizontalColorLegends.js"
import { CategoricalBin } from "../color/ColorScaleBin.js"

@observer
export class LineChartThumbnail
    extends React.Component<LineChartProps>
    implements ChartInterface, AxisManager
{
    constructor(props: LineChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): LineChartState {
        return this.props.chartState
    }

    @computed private get manager(): LineChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get innerBounds(): Bounds {
        const { left, right } = this.effectiveLabelWidths
        return this.bounds
            .padRight(right > 0 ? right + this.labelPadding : 0)
            .padLeft(left > 0 ? left + this.labelPadding : 0)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const defaults = getYAxisConfigDefaults(yAxisConfig)
        const custom = { hideAxis: true }
        return new AxisConfig({ ...defaults, ...custom, ...yAxisConfig }, this)
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig } = this.manager
        const custom = { labelPadding: 0, tickPadding: 2 }
        return new AxisConfig({ ...custom, ...xAxisConfig }, this)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig)
    }

    @computed get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.innerBounds,
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
        })
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed get placedSeries(): PlacedLineChartSeries[] {
        return toPlacedLineChartSeries(this.chartState.series, {
            chartState: this.chartState,
            dualAxis: this.dualAxis,
        })
    }

    @computed private get renderSeries(): RenderLineChartSeries[] {
        return toRenderLineChartSeries(this.placedSeries, {
            isFocusModeActive: this.chartState.isFocusModeActive,
            shouldElevateSingleSeries: false,
        })
    }

    @computed private get dotRadius(): number {
        // Map font size to dot radius
        const scale = scaleLinear().domain([11, 16]).range([2.5, 3.5])
        // Round to nearest .5 number
        return _.round(scale(this.fontSize) * 2) / 2
    }

    @computed private get spaceBetweenDotAndLabel(): number {
        return this.dotRadius
    }

    @computed private get labelPadding(): number {
        return this.dotRadius + this.spaceBetweenDotAndLabel
    }

    /** Start points displayed as dots */
    @computed private get visibleStartPoints(): PlacedPoint[] {
        return this.renderSeries
            .filter(
                (series) =>
                    this.visibleStartLabels.has(series.seriesName) &&
                    // Only show start points for historical series, not projected ones
                    !series.isProjection
            )
            .map((series) =>
                _.minBy(series.placedPoints, (point) => point.time)
            )
            .filter((point) => point !== undefined)
    }

    /** End points displayed as dots */
    @computed private get visibleEndPoints(): PlacedPoint[] {
        return this.renderSeries
            .filter(
                (series) =>
                    this.visibleEndLabels.has(series.seriesName) &&
                    // When projected series exist in the chart, only show end dots
                    // for the projected series. Otherwise, show end dots for all series
                    (!this.hasProjectedSeries || series.isProjection)
            )
            .map((series) =>
                _.maxBy(series.placedPoints, (point) => point.time)
            )
            .filter((point) => point !== undefined)
    }

    @computed private get labelFontSettings(): FontSettings {
        return {
            fontSize: Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize),
            fontWeight: 700,
            lineHeight: 1,
        }
    }

    @computed private get tickFontSettings(): FontSettings {
        return { ...this.labelFontSettings, fontWeight: 400 }
    }

    private formatLabel(value: number): string {
        return this.chartState.formatColumn.formatValueShortWithAbbreviations(
            value
        )
    }

    @computed private get hasProjectedSeries(): boolean {
        return this.chartState.series.some((series) => !!series.isProjection)
    }

    @computed private get labelsRange(): [number, number] {
        const {
            horizontalAxisPart,
            manager: { chartAreaPadding = 0 },
        } = this

        return this.bounds
            .expand({
                top: chartAreaPadding,
                bottom: chartAreaPadding + horizontalAxisPart.height,
            })
            .yRange()
    }

    @computed
    private get endLabelCandidateSeries(): readonly LineChartSeries[] {
        if (!this.manager.showSeriesLabels) return []

        let labelCandidateSeries = this.chartState.series

        // If there is a projected series, only show the labels for the projected ones
        if (this.hasProjectedSeries)
            labelCandidateSeries = labelCandidateSeries.filter(
                (series) => series.isProjection
            )

        // If any series is focused, only show the labels for the focused ones
        if (this.chartState.isFocusModeActive)
            labelCandidateSeries = labelCandidateSeries.filter(
                (series) => series.focus.active
            )

        return labelCandidateSeries
    }

    @computed private get endPointBySeriesName(): Map<
        SeriesName,
        LinePoint | undefined
    > {
        return new Map(
            this.endLabelCandidateSeries.map((series) => [
                series.seriesName,
                _.maxBy(series.points, (point) => point.x),
            ])
        )
    }

    @computed private get endLabelsSeries(): Omit<
        InitialAnchoredLabelSeries,
        "position"
    >[] {
        return this.endLabelCandidateSeries
            .map((series) => {
                const endPoint = this.endPointBySeriesName.get(
                    series.seriesName
                )
                if (!endPoint) return undefined

                const value = endPoint.y
                const label = this.formatLabel(value)

                const color = this.chartState.hasColorScale
                    ? darkenColorForLine(
                          this.chartState.getColorScaleColor(
                              endPoint.colorValue
                          )
                      )
                    : series.color

                return { seriesName: series.seriesName, value, label, color }
            })
            .filter((series) => series !== undefined)
    }

    private makeEndLabelsState({
        dualAxis,
    }: {
        dualAxis: DualAxis
    }): AnchoredLabelsState | undefined {
        if (!this.manager.showSeriesLabels) return undefined

        const series = this.endLabelsSeries.map((series) => {
            const endPoint = this.endPointBySeriesName.get(series.seriesName)

            const position = {
                x: dualAxis.horizontalAxis.place(endPoint?.x ?? 0),
                y: dualAxis.verticalAxis.place(endPoint?.y ?? 0),
            }

            return { ...series, position }
        })

        return new AnchoredLabelsState(series, {
            ...this.labelFontSettings,
            textAnchor: "start",
            yRange: this.labelsRange,
            labelPadding: this.labelPadding,
            anchorCollisionRadius: this.dotRadius,
            resolveCollision: (
                s1: InitialAnchoredLabelSeries,
                s2: InitialAnchoredLabelSeries
            ): InitialAnchoredLabelSeries => {
                const endPoint1 = this.endPointBySeriesName.get(s1.seriesName)
                const endPoint2 = this.endPointBySeriesName.get(s2.seriesName)

                const x1 = endPoint1?.x ?? 0
                const x2 = endPoint2?.x ?? 0

                // Prefer the series with the larger x value
                if (x1 > x2) return s1
                if (x2 > x1) return s2

                return s1 // no preference
            },
        })
    }

    @computed private get endLabelsState(): AnchoredLabelsState | undefined {
        return this.makeEndLabelsState({ dualAxis: this.dualAxis })
    }

    @computed
    private get startLabelCandidateSeries(): readonly LineChartSeries[] {
        if (!this.manager.showSeriesLabels) return []

        let labelCandidateSeries = this.chartState.series

        // If there is a projected series, only show the labels for the historical ones
        if (this.hasProjectedSeries)
            labelCandidateSeries = labelCandidateSeries.filter(
                (series) => !series.isProjection
            )

        // If any series is focused, only show the labels for the focused ones
        if (this.chartState.isFocusModeActive)
            labelCandidateSeries = labelCandidateSeries.filter(
                (series) => series.focus.active
            )

        return labelCandidateSeries
    }

    @computed private get startPointBySeriesName(): Map<
        SeriesName,
        LinePoint | undefined
    > {
        return new Map(
            this.startLabelCandidateSeries.map((series) => [
                series.seriesName,
                _.minBy(series.points, (point) => point.x),
            ])
        )
    }

    @computed private get shouldShowValueLabelsOnly(): boolean {
        return !!this.manager.useMinimalLabeling
    }

    @computed private get startLabelsMaxWidth(): number | undefined {
        return this.shouldShowValueLabelsOnly
            ? undefined
            : 0.25 * this.bounds.width
    }

    @computed private get startLabelsSeries(): Omit<
        InitialAnchoredLabelSeries,
        "position"
    >[] {
        return this.startLabelCandidateSeries
            .map((series) => {
                // Don't show start label if there is only a single point
                if (series.points.length < 2) return undefined

                const startPoint = this.startPointBySeriesName.get(
                    series.seriesName
                )
                if (!startPoint) return undefined

                const value = startPoint.y
                const label = this.shouldShowValueLabelsOnly
                    ? this.formatLabel(value)
                    : series.seriesName

                const color = this.chartState.hasColorScale
                    ? darkenColorForLine(
                          this.chartState.getColorScaleColor(
                              startPoint.colorValue
                          )
                      )
                    : series.color

                return { seriesName: series.seriesName, value, label, color }
            })
            .filter((series) => series !== undefined)
    }

    private makeStartLabelsState({
        dualAxis,
        visibleEndLabels,
    }: {
        dualAxis: DualAxis
        visibleEndLabels: Set<SeriesName>
    }): AnchoredLabelsState | undefined {
        if (!this.manager.showSeriesLabels || this.manager.hideStartValueLabel)
            return undefined

        // In relative mode, the start label is trivially 0%,
        // so we skip showing start labels to reduce clutter
        if (this.manager.isRelativeMode) return undefined

        const series = this.startLabelsSeries.map((series) => {
            const startPoint = this.startPointBySeriesName.get(
                series.seriesName
            )

            const position = {
                x: startPoint
                    ? dualAxis.horizontalAxis.place(startPoint.x)
                    : dualAxis.bounds.left,
                y: dualAxis.verticalAxis.place(series.value),
            }

            return { ...series, position }
        })

        return new AnchoredLabelsState(series, {
            ...this.labelFontSettings,
            maxWidth: this.startLabelsMaxWidth,
            textAnchor: "end",
            labelPadding: this.labelPadding,
            anchorCollisionRadius: this.dotRadius,
            yRange: this.labelsRange,
            resolveCollision: (
                s1: InitialAnchoredLabelSeries,
                s2: InitialAnchoredLabelSeries
            ): InitialAnchoredLabelSeries => {
                // Prefer to label series that have an end label
                if (visibleEndLabels.has(s1.seriesName)) return s1
                if (visibleEndLabels.has(s2.seriesName)) return s2

                const startPoint1 = this.startPointBySeriesName.get(
                    s1.seriesName
                )
                const startPoint2 = this.startPointBySeriesName.get(
                    s2.seriesName
                )

                const x1 = startPoint1?.x ?? 0
                const x2 = startPoint2?.x ?? 0

                // Prefer the series with the larger x value
                if (x1 > x2) return s1
                if (x2 > x1) return s2

                return s1 // No preference
            },
        })
    }

    @computed private get startLabelsState(): AnchoredLabelsState | undefined {
        return this.makeStartLabelsState({
            dualAxis: this.dualAxis,
            visibleEndLabels: this.visibleEndLabels,
        })
    }

    /**
     * Estimated width of the start and end labels, used by innerBounds
     * to reserve space on the left and right of the chart area.
     *
     * Ideally, we'd derive this from the final label states, which know
     * exactly which labels are visible after collision detection. But that
     * would introduce a cyclic dependency: the label states need the axis
     * for pixel positions, the axis needs innerBounds, and innerBounds needs
     * these widths. To break the cycle, we run a preliminary layout pass
     * using the full bounds (without label padding).
     */
    @computed private get estimatedLabelWidths(): SideWidths {
        const approximateDualAxis = new DualAxis({
            bounds: this.bounds,
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
        })

        const endLabelsState = this.makeEndLabelsState({
            dualAxis: approximateDualAxis,
        })

        const visibleEndLabels = new Set(
            endLabelsState?.series.map((series) => series.seriesName)
        )

        const startLabelsState = this.makeStartLabelsState({
            dualAxis: approximateDualAxis,
            visibleEndLabels,
        })

        return {
            left: startLabelsState?.width ?? 0,
            right: endLabelsState?.width ?? 0,
        }
    }

    // Consumed by FacetChart to align chart content across facets
    @computed get verticalLabelWidths(): SideWidths {
        return {
            left: Math.max(this.estimatedLabelWidths.left, this.zeroLabelWidth),
            right: this.estimatedLabelWidths.right,
        }
    }

    // Consumed by FacetChart to align the facet label with the plot content
    // (here: the line chart's domain line)
    @computed get contentInset(): SideWidths | undefined {
        if (this.chartState.errorInfo.reason) return undefined
        const { innerBounds, bounds } = this
        return {
            left: innerBounds.left - bounds.left,
            right: bounds.right - innerBounds.right,
        }
    }

    @computed private get effectiveLabelWidths(): SideWidths {
        const shared = this.manager.sharedVerticalLabelWidths
        return {
            left: Math.max(shared?.left ?? 0, this.verticalLabelWidths.left),
            right: Math.max(shared?.right ?? 0, this.verticalLabelWidths.right),
        }
    }

    @computed private get visibleStartLabels(): Set<SeriesName> {
        return new Set(
            this.startLabelsState?.series.map((series) => series.seriesName)
        )
    }

    @computed private get visibleEndLabels(): Set<SeriesName> {
        return new Set(
            this.endLabelsState?.series.map((series) => series.seriesName)
        )
    }

    @computed get externalLegend(): HorizontalColorLegendManager {
        const numericLegendData = this.chartState.hasColorScale
            ? _.sortBy(
                  this.chartState.colorScale.legendBins,
                  (bin) => bin instanceof CategoricalBin
              )
            : []

        const categoricalLegendData = this.chartState.hasColorScale
            ? []
            : this.chartState.series.map(
                  (series, index) =>
                      new CategoricalBin({
                          index,
                          value: series.seriesName,
                          label: series.displayName,
                          color: series.color,
                      })
              )

        return {
            categoricalLegendData,
            numericLegendData,
            legendTitle: this.chartState.hasColorScale
                ? this.chartState.colorScale.legendDescription
                : undefined,
            legendTickSize: 1,
            numericBinSize: 6,
            categoricalLegendStyleConfig: CATEGORICAL_LEGEND_STYLE,
            numericLegendStyleConfig: NUMERIC_LEGEND_STYLE,
        }
    }

    @computed private get shouldShowZeroLine(): boolean {
        const { verticalAxisPart } = this
        if (verticalAxisPart.isLogScale) return false
        // Only draw the zero line when 0 is actually within the axis domain
        const [min, max] = verticalAxisPart.domain
        return min <= 0 && max >= 0
    }

    @computed private get zeroLabelText(): string | undefined {
        if (!this.shouldShowZeroLine) return undefined
        return this.formatLabel(0)
    }

    @computed private get zeroLabelWidth(): number {
        const { zeroLabelText, tickFontSettings } = this
        if (!zeroLabelText) return 0
        return Bounds.forText(zeroLabelText, tickFontSettings).width
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
            <>
                {this.shouldShowZeroLine ? (
                    <VerticalAxisZeroLine
                        axis={this.dualAxis.verticalAxis}
                        bounds={this.dualAxis.innerBounds}
                        strokeWidth={0.5}
                    />
                ) : (
                    // The domain line is the baseline at the bottom of the plot.
                    // When the zero line is shown it already serves as a baseline,
                    // so we only draw the domain line in its absence
                    <VerticalAxisDomainLine
                        verticalAxis={this.dualAxis.verticalAxis}
                        bounds={this.dualAxis.innerBounds}
                        strokeWidth={0.5}
                    />
                )}
                {this.zeroLabelText && (
                    <ZeroLineLabel
                        text={this.zeroLabelText}
                        axis={this.dualAxis.verticalAxis}
                        bounds={this.dualAxis.innerBounds}
                        xOffset={this.labelPadding}
                        fontSettings={this.tickFontSettings}
                    />
                )}
                {!this.dualAxis.horizontalAxis.hideAxis && (
                    <HorizontalAxisComponent
                        axis={this.dualAxis.horizontalAxis}
                        bounds={this.dualAxis.bounds}
                        showEndpointsOnly
                    />
                )}
                <Lines
                    series={this.renderSeries}
                    dualAxis={this.dualAxis}
                    multiColor={this.chartState.hasColorScale}
                    hidePoints
                    lineStrokeWidth={1.5}
                    lineOutlineWidth={0}
                    isStatic={this.manager.isStatic}
                />
                {this.visibleStartPoints.map((point, index) => (
                    <Dot key={index} point={point} radius={this.dotRadius} />
                ))}
                {this.visibleEndPoints.map((point, index) => (
                    <Dot key={index} point={point} radius={this.dotRadius} />
                ))}
                {this.startLabelsState && (
                    <AnchoredLabels state={this.startLabelsState} />
                )}
                {this.endLabelsState && (
                    <AnchoredLabels state={this.endLabelsState} />
                )}
            </>
        )
    }
}

function Dot({
    point,
    radius,
}: {
    point: PlacedPoint
    radius: number
}): React.ReactElement | null {
    return <circle cx={point.x} cy={point.y} r={radius} fill={point.color} />
}

/** Value label for the zero line, placed in the left gutter of the plot area. */
function ZeroLineLabel({
    text,
    axis,
    bounds,
    xOffset,
    fontSettings,
    fill = GRAPHER_LIGHT_TEXT,
}: {
    text: string
    axis: VerticalAxis
    bounds: Bounds
    xOffset: number
    fontSettings: FontSettings
    fill?: string
}): React.ReactElement {
    return (
        <text
            x={(bounds.left - xOffset).toFixed(2)}
            y={axis.place(0).toFixed(2)}
            dy={dyFromAlign(VerticalAlign.middle)}
            textAnchor="end"
            fontSize={fontSettings.fontSize}
            fontWeight={fontSettings.fontWeight}
            fill={fill}
        >
            {text}
        </text>
    )
}
