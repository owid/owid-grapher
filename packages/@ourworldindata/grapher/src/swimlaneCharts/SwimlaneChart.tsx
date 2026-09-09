import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    exposeInstanceOnWindow,
    makeFigmaId,
} from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    FontSettings,
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
    ENTITY_LABEL_CHART_GAP,
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

    @computed private get series(): SwimlaneSeries[] {
        return this.chartState.series
    }

    @computed private get bounds(): Bounds {
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS).padBottom(
            TICK_LABEL_OVERFLOW_PADDING
        )
    }

    @computed private get availableHeightPerSeries(): number {
        return this.bounds.height / this.series.length
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
            minLabelWidth: 0.3 * this.bounds.width,
            maxLabelWidth: 0.66 * this.bounds.width,
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
        return this.bounds.padLeft(
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
                <HorizontalAxisComponent
                    bounds={this.bounds}
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
