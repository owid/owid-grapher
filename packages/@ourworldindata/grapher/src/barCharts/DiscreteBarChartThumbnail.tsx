import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { DiscreteBarChartState } from "./DiscreteBarChartState"
import {
    DiscreteBarChart,
    type DiscreteBarChartProps,
} from "./DiscreteBarChart.js"
import { DiscreteBars } from "./DiscreteBars"
import { DiscreteBarChartManager } from "./DiscreteBarChartConstants.js"
import { GrapherVariant } from "@ourworldindata/types"

@observer
export class DiscreteBarChartThumbnail
    extends React.Component<DiscreteBarChartProps>
    implements ChartInterface
{
    constructor(props: DiscreteBarChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): DiscreteBarChartState {
        return this.props.chartState
    }

    @computed get manager(): DiscreteBarChartManager {
        return this.props.chartState.manager
    }

    @computed private get isMinimal(): boolean {
        return this.manager.variant === GrapherVariant.MinimalThumbnail
    }

    override render(): React.ReactElement | null {
        if (this.chartState.errorInfo.reason) return null

        return this.isMinimal ? (
            <DiscreteBars {...this.props} series={this.chartState.series} />
        ) : (
            <DiscreteBarChart {...this.props} />
        )
    }
}
