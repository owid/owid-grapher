import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { MarimekkoChartState } from "./MarimekkoChartState"
import { type MarimekkoChartProps } from "./MarimekkoChart.js"
import {
    MarimekkoChartManager,
    PlacedMarimekkoSeries,
    RenderMarimekkoSeries,
} from "./MarimekkoChartConstants"
import { Bounds } from "@ourworldindata/utils"
import { EntityName } from "@ourworldindata/types"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { AxisConfig } from "../axis/AxisConfig"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
} from "../core/GrapherConstants"
import { getVisibleLabels, scaleFontSize } from "../chart/ChartUtils"
import { MarimekkoBars } from "./MarimekkoBars"
import { DualAxisComponent } from "../axis/AxisViews"
import {
    toMarimekkoNoDataArea,
    toPlacedMarimekkoSeries,
    toRenderMarimekkoSeries,
} from "./MarimekkoChartHelpers"
import { MarimekkoInternalLabels } from "./MarimekkoInternalLabels"
import { NoDataMessage } from "../noDataMessage/NoDataMessage"
import { InteractionState } from "../interaction/InteractionState"

const LABEL_PADDING = 4

@observer
export class MarimekkoChartThumbnail
    extends React.Component<MarimekkoChartProps>
    implements ChartInterface
{
    constructor(props: MarimekkoChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): MarimekkoChartState {
        return this.props.chartState
    }

    @computed get manager(): MarimekkoChartManager {
        return this.chartState.manager
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed get innerBounds(): Bounds {
        // Allow internal labels to eat into the thumbnail padding
        return this.bounds.padTop(this.labelHeight ? this.labelHeight - 6 : 0)
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get labelFontSize(): number {
        return scaleFontSize(12, this.fontSize)
    }

    @computed get labelHeight(): number {
        return this.shouldShowLabels ? this.labelFontSize + LABEL_PADDING : 0
    }

    @computed private get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const custom = { hideAxis: true, hideGridlines: true }
        return new AxisConfig({ ...yAxisConfig, ...custom }, this)
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xAxisConfig } = this.manager
        const custom = { hideAxis: true, hideGridlines: true }
        return new AxisConfig({ ...xAxisConfig, ...custom }, this)
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return this.chartState.toVerticalAxis(this.yAxisConfig)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return this.chartState.toHorizontalAxis(this.xAxisConfig)
    }

    @computed private get dualAxis(): DualAxis {
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

    @computed get placedSeries(): PlacedMarimekkoSeries[] {
        const { x0, y0, sortedSeries } = this.chartState
        return toPlacedMarimekkoSeries(sortedSeries, {
            x0,
            y0,
            dualAxis: this.dualAxis,
        })
    }

    /** Only focus mutes the other bars, not selection */
    @computed private get renderSeries(): RenderMarimekkoSeries[] {
        const { focusArray } = this.chartState
        const focusedSeries = this.placedSeries.map((series) => ({
            ...series,
            focus: new InteractionState(
                focusArray.has(series.entityName),
                focusArray.hasFocusedSeries
            ),
        }))
        return toRenderMarimekkoSeries(focusedSeries)
    }

    @computed private get placedSeriesByEntityName(): Map<
        string,
        PlacedMarimekkoSeries
    > {
        return new Map(
            this.placedSeries.map((series) => [series.entityName, series])
        )
    }

    @computed private get labelledEntityNames(): EntityName[] {
        const { selectionArray, focusArray } = this.chartState
        return focusArray.hasFocusedSeries
            ? focusArray.seriesNames
            : selectionArray.selectedEntityNames
    }

    @computed private get shouldShowLabels(): boolean {
        return (
            getVisibleLabels(this.manager.labelMode).rowLabelNames &&
            this.labelledEntityNames.length > 0
        )
    }

    @computed private get shouldShowNoDataLabel(): boolean {
        return getVisibleLabels(this.manager.labelMode).values
    }

    @computed private get labelledSeries(): PlacedMarimekkoSeries[] {
        if (!this.shouldShowLabels) return []
        return this.labelledEntityNames
            .map((entityName) => this.placedSeriesByEntityName.get(entityName))
            .filter((series) => series !== undefined)
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
            <g>
                <DualAxisComponent dualAxis={this.dualAxis} showEndpointsOnly />
                <MarimekkoBars
                    series={this.renderSeries}
                    noDataArea={toMarimekkoNoDataArea(this.placedSeries)}
                    fontSize={this.fontSize}
                    patternIdSuffix={this.manager.patternIdSuffix}
                    isFocusModeActive={this.chartState.isFocusModeActive}
                    showNoDataLabel={this.shouldShowNoDataLabel}
                />
                <MarimekkoInternalLabels
                    series={this.labelledSeries}
                    focusedEntityNames={
                        this.chartState.focusArray.seriesNameSet
                    }
                    dualAxis={this.dualAxis}
                    fontSize={this.labelFontSize}
                    labelPadding={LABEL_PADDING}
                />
            </g>
        )
    }
}
