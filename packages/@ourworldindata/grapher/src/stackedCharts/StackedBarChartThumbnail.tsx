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
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { Bounds, excludeUndefined } from "@ourworldindata/utils"
import { AxisConfig, AxisManager } from "../axis/AxisConfig"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { Time } from "@ourworldindata/types"
import {
    PlacedStackedBarSeries,
    RenderStackedBarSeries,
} from "./StackedConstants"
import {
    getXAxisConfigDefaultsForStackedBar,
    resolveCollision,
    toPlacedStackedBarSeries,
} from "./StackedUtils"
import {
    HorizontalAxisComponent,
    VerticalAxisZeroLine,
} from "../axis/AxisViews"
import { StackedBars } from "./StackedBars"
import { InitialSimpleLabelSeries } from "../verticalLabels/SimpleVerticalLabelsTypes.js"
import { SimpleVerticalLabelsState } from "../verticalLabels/SimpleVerticalLabelsState"
import { SimpleVerticalLabels } from "../verticalLabels/SimpleVerticalLabels"
import { NoDataModal } from "../noDataModal/NoDataModal"
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
        return new AxisConfig({ ...custom, ...defaults, ...xAxisConfig }, this)
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
            fontSize: Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize),
            fontWeight: 500,
            lineHeight: 1,
        }
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

    @computed private get labelsMaxWidth(): number {
        return 0.25 * this.bounds.width
    }

    @computed private get labelsSeries(): Omit<
        InitialSimpleLabelSeries,
        "position"
    >[] {
        if (!this.manager.showLegend) return []

        return excludeUndefined(
            this.chartState.series.map((series, seriesIndex) => {
                const { seriesName, color, focus } = series

                // Don't label background series
                if (focus?.background) return undefined

                const value = this.chartState.midpoints[seriesIndex]
                const label = seriesName

                return { seriesName, value, label, color }
            })
        )
    }

    private makeVerticalLabelsState({
        dualAxis,
    }: {
        dualAxis: DualAxis
    }): SimpleVerticalLabelsState | undefined {
        if (this.labelsSeries.length === 0) return undefined

        const series = this.labelsSeries.map((series) => {
            const position = {
                x: dualAxis.bounds.right,
                y: dualAxis.verticalAxis.place(series.value),
            }

            return { ...series, position }
        })

        return new SimpleVerticalLabelsState(series, {
            ...this.labelFontSettings,
            maxWidth: this.labelsMaxWidth,
            labelOffset: LEGEND_PADDING,
            yRange: this.labelsRange,
            resolveCollision: (
                s1: InitialSimpleLabelSeries,
                s2: InitialSimpleLabelSeries
            ): InitialSimpleLabelSeries => {
                const series1 = this.chartState.seriesByName.get(s1.seriesName)
                const series2 = this.chartState.seriesByName.get(s2.seriesName)

                if (!series1 || !series2) return s1 // no preference

                const picked = resolveCollision(series1, series2)
                if (picked?.seriesName === s1.seriesName) return s1
                if (picked?.seriesName === s2.seriesName) return s2

                return s1 // no preference
            },
        })
    }

    @computed private get verticalLabelsState():
        | SimpleVerticalLabelsState
        | undefined {
        return this.makeVerticalLabelsState({ dualAxis: this.dualAxis })
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

        const labelsState = this.makeVerticalLabelsState({
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
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return (
            <>
                <VerticalAxisZeroLine
                    verticalAxis={this.dualAxis.verticalAxis}
                    bounds={this.dualAxis.innerBounds}
                />
                <HorizontalAxisComponent
                    axis={this.dualAxis.horizontalAxis}
                    bounds={this.dualAxis.bounds}
                    showEndpointsOnly
                />
                <StackedBars series={this.renderSeries} />
                {this.verticalLabelsState && (
                    <SimpleVerticalLabels state={this.verticalLabelsState} />
                )}
            </>
        )
    }
}
