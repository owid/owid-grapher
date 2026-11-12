import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedBarChartState } from "./StackedBarChartState.js"
import { type StackedBarChartProps } from "./StackedBarChart.js"
import { ChartManager } from "../chart/ChartManager"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    FontSettings,
} from "../core/GrapherConstants"
import { getVisibleLabels, scaleFontSize } from "../chart/ChartUtils"
import { Bounds } from "@ourworldindata/utils"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { Time } from "@ourworldindata/types"
import {
    PlacedStackedBarSeries,
    RenderStackedBarSeries,
} from "./StackedConstants"
import {
    getXAxisConfigDefaultsForStackedBar,
    toInitialAnchoredLabelSeries,
    makeStackedLabelComparator,
    toPlacedStackedBarSeries,
} from "./StackedUtils"
import {
    HorizontalAxisComponent,
    VerticalAxisZeroLine,
} from "../axis/AxisViews"
import { StackedBars } from "./StackedBars"
import { InitialAnchoredLabelSeries } from "../anchoredLabels/AnchoredLabelsTypes.js"
import { AnchoredLabelsState } from "../anchoredLabels/AnchoredLabelsState"
import { AnchoredLabels } from "../anchoredLabels/AnchoredLabels"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"
import { resolveEmphasis } from "../interaction/Emphasis.js"

const LEGEND_PADDING = 4

@observer
export class StackedBarChartThumbnail
    extends React.Component<StackedBarChartProps>
    implements ChartInterface, AxisManager
{
    constructor(props: StackedBarChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): StackedBarChartState {
        return this.props.chartState
    }

    @computed get manager(): ChartManager {
        return this.chartState.manager
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed private get innerBounds(): Bounds {
        return this.bounds.padRight(this.estimatedLabelWidth)
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig } = this.manager
        const defaults = getXAxisConfigDefaultsForStackedBar(this.chartState)
        const custom = { labelPadding: 0 }
        const { axisText } = getVisibleLabels(this.manager.labelMode)
        const labelModeOverrides = axisText ? {} : { hideTickLabels: true }
        return new AxisConfig(
            { ...custom, ...defaults, ...xAxisConfig, ...labelModeOverrides },
            this
        )
    }

    @computed private get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const custom = { nice: true, hideAxis: true }
        return new AxisConfig({ ...custom, ...yAxisConfig }, this)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig)
    }

    @computed private get dualAxis(): DualAxis {
        const { horizontalAxisPart, verticalAxisPart } = this
        return new DualAxis({
            bounds: this.innerBounds,
            horizontalAxis: horizontalAxisPart,
            verticalAxis: verticalAxisPart,
        })
    }

    @computed get xAxis(): HorizontalAxis {
        return this.dualAxis.horizontalAxis
    }

    @computed get yAxis(): VerticalAxis {
        return this.dualAxis.verticalAxis
    }

    @computed private get labelFontSettings(): FontSettings {
        return {
            fontSize: scaleFontSize(12, this.fontSize),
            fontWeight: 500,
            lineHeight: 1,
        }
    }

    @computed private get labelsRange(): [number, number] {
        return this.bounds.expand(this.manager.chartAreaPadding ?? 0).yRange()
    }

    @computed private get labelsMaxWidth(): number {
        return 0.3 * this.bounds.width
    }

    @computed private get labelsSeries(): Omit<
        InitialAnchoredLabelSeries,
        "position"
    >[] {
        if (
            !this.manager.showSeriesLabels ||
            !getVisibleLabels(this.manager.labelMode).endLabelNames
        )
            return []

        return this.chartState.series.map((series, seriesIndex) => {
            const { seriesName, shortEntityName, color, focus } = series
            const value = this.chartState.midpoints[seriesIndex]
            const label = shortEntityName ?? seriesName
            const emphasis = resolveEmphasis({ focus })
            return { seriesName, value, label, color, emphasis }
        })
    }

    private makeAnchoredLabelsState({
        dualAxis,
    }: {
        dualAxis: DualAxis
    }): AnchoredLabelsState | undefined {
        if (this.labelsSeries.length === 0) return undefined

        const series = toInitialAnchoredLabelSeries(
            this.labelsSeries,
            this.chartState.seriesByName,
            dualAxis
        )

        return new AnchoredLabelsState(series, {
            ...this.labelFontSettings,
            maxWidth: this.labelsMaxWidth,
            labelPadding: LEGEND_PADDING,
            xRange: dualAxis.bounds.xRange(),
            yRanges: { edge: this.labelsRange },
            compare: makeStackedLabelComparator(this.chartState.seriesByName),
        })
    }

    @computed private get anchoredLabelsState():
        | AnchoredLabelsState
        | undefined {
        return this.makeAnchoredLabelsState({ dualAxis: this.dualAxis })
    }

    /**
     * Estimated width of the labels, used by innerBounds to reserve space
     * on the right side of the chart area.
     *
     * Ideally, we'd derive this from the final label state, which knows
     * exactly which labels are visible after collision detection. But that
     * would introduce a cyclic dependency: the label state needs the axis
     * for pixel positions, the axis needs innerBounds, and innerBounds needs
     * this width. To break the cycle, we run a preliminary layout pass
     * using the full bounds (without label padding).
     */
    @computed private get estimatedLabelWidth(): number {
        const approximateDualAxis = new DualAxis({
            bounds: this.bounds,
            horizontalAxis: this.horizontalAxisPart,
            verticalAxis: this.verticalAxisPart,
        })

        const labelsState = this.makeAnchoredLabelsState({
            dualAxis: approximateDualAxis,
        })

        const width = labelsState?.width ?? 0

        return width > 0 ? width + LEGEND_PADDING : 0
    }

    @computed
    private get placedSeries(): readonly PlacedStackedBarSeries<Time>[] {
        return toPlacedStackedBarSeries(this.chartState.series, this.dualAxis)
    }

    @computed private get renderSeries(): RenderStackedBarSeries<Time>[] {
        return this.placedSeries.map((series) => ({
            ...series,
            emphasis: resolveEmphasis({ focus: series.focus }),
        }))
    }

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataMessage
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return (
            <>
                <VerticalAxisZeroLine
                    axis={this.dualAxis.verticalAxis}
                    bounds={this.dualAxis.innerBounds}
                />
                {!this.dualAxis.horizontalAxis.hideAxis && (
                    <HorizontalAxisComponent
                        axis={this.dualAxis.horizontalAxis}
                        bounds={this.dualAxis.bounds}
                        showEndpointsOnly
                    />
                )}
                <StackedBars series={this.renderSeries} />
                {this.anchoredLabelsState && (
                    <AnchoredLabels state={this.anchoredLabelsState} />
                )}
            </>
        )
    }
}
