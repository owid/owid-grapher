import React from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { StackedDiscreteBarChartState } from "./StackedDiscreteBarChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"

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

    render(): React.ReactElement {
        return (
            <text x={15} y={30}>
                Stacked discrete bar chart thumbnail
            </text>
        )
    }
}
