import React from "react"
import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { MarimekkoChartState } from "./MarimekkoChartState"
import { type MarimekkoChartProps } from "./MarimekkoChart.js"
import {
    Item,
    MarimekkoChartManager,
    PlacedItem,
} from "./MarimekkoChartConstants"
import { Position } from "@ourworldindata/types"
import { CoreColumn } from "@ourworldindata/core-table"
import { Bounds } from "@ourworldindata/utils"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { AxisConfig } from "../axis/AxisConfig"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
} from "../core/GrapherConstants"
import { MarimekkoBars } from "./MarimekkoBars"

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
        return this.bounds
    }

    @computed private get xColumnSlug(): string | undefined {
        return this.chartState.xColumnSlug
    }

    @computed private get xColumn(): CoreColumn | undefined {
        return this.chartState.xColumn
    }

    @computed private get yColumns(): CoreColumn[] {
        return this.chartState.yColumns
    }

    @computed private get baseFontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get fontSize(): number {
        return this.baseFontSize
    }

    // dual axis start

    // TODO: refactor DualAxis

    @computed private get yAxisConfig(): AxisConfig {
        const custom = { hideAxis: true } // todo: thumbnail only
        const yAxisConfig = { ...custom, ...this.manager.yAxisConfig }
        return new AxisConfig(yAxisConfig, this)
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xColumnSlug } = this
        return new AxisConfig(
            {
                ...this.manager.xAxisConfig,
                orient: Position.top,
                hideAxis: xColumnSlug === undefined,
                hideGridlines: xColumnSlug === undefined,
            },
            this
        )
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        const config = this.yAxisConfig
        const axis = config.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(this.chartState.yDomainDefault)

        axis.formatColumn = this.yColumns[0]
        axis.label = ""

        return axis
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        const { manager, xColumn } = this
        const { xDomainDefault } = this.chartState
        const config = this.xAxisConfig
        let axis = config.toHorizontalAxis()
        if (manager.isRelativeMode && xColumn) {
            // MobX and classes  interact in an annoying way here so we have to construct a new object via
            // an object copy of the AxisConfig class instance to be able to set a property without
            // making MobX unhappy about a mutation originating from a computed property
            axis = new HorizontalAxis(
                new AxisConfig(
                    { ...config.toObject(), maxTicks: 10 },
                    config.axisManager
                ),
                config.axisManager
            )
            axis.domain = [0, 100]
        } else axis.updateDomainPreservingUserSettings(xDomainDefault)

        axis.formatColumn = xColumn

        // axis.label = this.currentHorizontalAxisLabel
        axis.label = ""
        return axis
    }

    @computed private get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.innerBounds,
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
            comparisonLines: this.manager.comparisonLines,
        })
    }

    // dual axis end

    @computed get items(): Item[] {
        return this.chartState.items
    }

    @computed get placedItems(): PlacedItem[] {
        const { dualAxis } = this
        const { x0, sortedItems } = this.chartState
        const placedItems: PlacedItem[] = []
        let currentX = 0
        for (const item of sortedItems) {
            placedItems.push({ ...item, xPosition: currentX })
            const xValue = item.xPoint?.value ?? 1 // one is the default here because if no x dim is given we make all bars the same width
            const preciseX =
                dualAxis.horizontalAxis.place(xValue) -
                dualAxis.horizontalAxis.place(x0)
            currentX += preciseX
        }
        return placedItems
    }

    override render(): React.ReactElement {
        return (
            <g>
                <MarimekkoBars
                    dualAxis={this.dualAxis}
                    placedItems={this.placedItems}
                    fontSize={this.fontSize}
                    x0={this.chartState.x0}
                    y0={this.chartState.y0}
                    selectionArray={this.chartState.selectionArray}
                    selectedItems={this.chartState.selectedItems}
                />
            </g>
        )
    }
}
