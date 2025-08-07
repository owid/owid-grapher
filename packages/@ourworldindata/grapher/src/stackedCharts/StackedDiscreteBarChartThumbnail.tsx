import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedDiscreteBarChartState } from "./StackedDiscreteBarChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { StackedDiscreteBars } from "./StackedDiscreteBars"

@observer
export class StackedDiscreteBarChartThumbnail
    extends React.Component<ChartComponentProps<StackedDiscreteBarChartState>>
    implements ChartInterface
{
    constructor(props: ChartComponentProps<StackedDiscreteBarChartState>) {
        super(props)
        // Ensure that the component is observable
        makeObservable(this)
    }

    @computed get chartState(): StackedDiscreteBarChartState {
        return this.props.chartState
    }

    override render(): React.ReactElement | null {
        if (this.chartState.errorInfo.reason) return null
        return <StackedDiscreteBars {...this.props} />
    }
}
