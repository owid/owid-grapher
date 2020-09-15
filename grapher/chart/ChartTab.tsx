import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds } from "grapher/utils/Bounds"
import { Grapher } from "grapher/core/Grapher"
import { GrapherView } from "grapher/core/GrapherView"
import { ChartLayout, ChartLayoutView } from "./ChartLayout"
import { LoadingOverlay } from "grapher/loadingIndicator/LoadingOverlay"
import { getChartComponent } from "./ChartTypeMap"

@observer
export class ChartTab extends React.Component<{
    grapher: Grapher
    grapherView: GrapherView
    bounds: Bounds
}> {
    @computed get layout() {
        const that = this
        return new ChartLayout({
            get grapher() {
                return that.props.grapher
            },
            get grapherView() {
                return that.props.grapherView
            },
            get bounds() {
                return that.props.bounds
            },
        })
    }

    renderChart() {
        const options = this.props.grapher
        const type = options.type
        const innerBounds = this.layout.innerBounds

        if (!options.isReady) return <LoadingOverlay bounds={innerBounds} />

        const bounds =
            type === "SlopeChart"
                ? innerBounds.padTop(20)
                : innerBounds.padTop(20).padBottom(15)

        // Switch to bar chart if a single year is selected
        const chartTypeName =
            type === "LineChart" && options.lineChartTransform.isSingleTime
                ? "DiscreteBar"
                : type

        const ChartType = getChartComponent(chartTypeName) as any // todo: add typing

        return ChartType ? (
            <ChartType bounds={bounds} options={options} />
        ) : null
    }

    render() {
        return (
            <ChartLayoutView layout={this.layout}>
                {this.renderChart()}
            </ChartLayoutView>
        )
    }
}
