import * as React from "react"
import { Component } from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { DumbbellChartState } from "./DumbbellChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap"

// TODO: This is a stub implementation. Fill in with actual dumbbell chart thumbnail rendering.
@observer
export class DumbbellChartThumbnail
    extends Component<ChartComponentProps<DumbbellChartState>>
    implements ChartInterface
{
    @computed get chartState(): DumbbellChartState {
        return this.props.chartState
    }

    override render(): React.ReactElement {
        return (
            <text x={20} y={20}>
                Dumbbell chart thumbnail
            </text>
        )
    }
}
