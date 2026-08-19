import * as React from "react"
import { Component } from "react"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { DumbbellChartState } from "./DumbbellChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap"
import { DumbbellChart, DumbbellChartProps } from "./DumbbellChart.js"
import { DumbbellChartManager } from "./DumbbellChartConstants.js"

@observer
export class DumbbellChartThumbnail
    extends Component<ChartComponentProps<DumbbellChartState>>
    implements ChartInterface
{
    constructor(props: DumbbellChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): DumbbellChartState {
        return this.props.chartState
    }

    @computed get manager(): DumbbellChartManager {
        return this.props.chartState.manager
    }

    override render(): React.ReactElement {
        return <DumbbellChart {...this.props} />
    }
}
