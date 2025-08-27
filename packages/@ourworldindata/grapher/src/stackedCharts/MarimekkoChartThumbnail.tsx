import React from "react"
import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { MarimekkoChartState } from "./MarimekkoChartState"
import { type MarimekkoChartProps } from "./MarimekkoChart.js"
import { MarimekkoChartManager, PlacedItem } from "./MarimekkoChartConstants"
import { Bounds } from "@ourworldindata/utils"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { AxisConfig } from "../axis/AxisConfig"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_12,
} from "../core/GrapherConstants"
import { MarimekkoBars } from "./MarimekkoBars"
import { DualAxisComponent } from "../axis/AxisViews"
import { toPlacedMarimekkoItems } from "./MarimekkoChartHelpers"
import { MarimekkoInternalLabels } from "./MarimekkoInternalLabels"
import { NoDataModal } from "../noDataModal/NoDataModal"

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
        return (
            this.bounds
                // Allow internal labels to eat into the thumbnail padding
                .padTop(this.labelHeight ? this.labelHeight - 6 : 0)
                // Add some bottom padding since the axis tick labels are
                // center-aligned and eat into the thumbnail padding
                .padBottom(6)
        )
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get labelFontSize(): number {
        return Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
    }

    @computed get labelHeight(): number {
        return this.shouldShowLabels ? this.labelFontSize + LABEL_PADDING : 0
    }

    @computed private get yAxisConfig(): AxisConfig {
        const { yAxisConfig } = this.manager
        const custom = { hideGridlines: true, hideAxis: true }
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

    @computed get placedItems(): PlacedItem[] {
        return toPlacedMarimekkoItems(this.chartState, {
            dualAxis: this.dualAxis,
        })
    }

    @computed private get placedItemsMap(): Map<string, PlacedItem> {
        return new Map(this.placedItems.map((item) => [item.entityName, item]))
    }

    @computed private get shouldShowLabels(): boolean {
        return this.chartState.isFocusModeActive
    }

    @computed private get labelledItems(): PlacedItem[] {
        if (!this.shouldShowLabels) return []
        return this.chartState.focusArray.seriesNames
            .map((entityName) => this.placedItemsMap.get(entityName))
            .filter((item) => item !== undefined)
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
            <g>
                <DualAxisComponent dualAxis={this.dualAxis} showEndpointsOnly />
                <MarimekkoBars
                    dualAxis={this.dualAxis}
                    placedItems={this.placedItems}
                    fontSize={this.fontSize}
                    x0={this.chartState.x0}
                    y0={this.chartState.y0}
                    selectionArray={this.chartState.selectionArray}
                    selectedItems={this.chartState.selectedItems}
                    isFocusModeActive={this.chartState.isFocusModeActive}
                />
                <MarimekkoInternalLabels
                    items={this.labelledItems}
                    dualAxis={this.dualAxis}
                    x0={this.chartState.x0}
                    y0={this.chartState.y0}
                    fontSize={this.labelFontSize}
                    labelPadding={LABEL_PADDING}
                />
            </g>
        )
    }
}
