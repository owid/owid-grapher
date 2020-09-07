import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { SlopeChart } from "grapher/slopeCharts/SlopeChart"
import { Bounds } from "grapher/utils/Bounds"
import { Grapher } from "grapher/core/Grapher"
import { GrapherView } from "grapher/core/GrapherView"
import { ScatterPlot } from "grapher/scatterCharts/ScatterPlot"
import { LineChart } from "grapher/lineCharts/LineChart"
import { StackedAreaChart } from "grapher/areaCharts/StackedAreaChart"
import { DiscreteBarChart } from "grapher/barCharts/DiscreteBarChart"
import { StackedBarChart } from "grapher/barCharts/StackedBarChart"
import { ChartLayout, ChartLayoutView } from "./ChartLayout"
import { TimeScatter } from "grapher/scatterCharts/TimeScatter"
import { LoadingOverlay } from "grapher/loadingIndicator/LoadingOverlay"

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
        const { grapher } = this.props
        const bounds = this.layout.innerBounds

        if (!grapher.isReady) {
            return <LoadingOverlay bounds={bounds} />
        } else if (grapher.isSlopeChart) {
            return <SlopeChart bounds={bounds.padTop(20)} grapher={grapher} />
        } else if (grapher.isScatter) {
            return (
                <ScatterPlot
                    bounds={bounds.padTop(20).padBottom(15)}
                    grapher={grapher}
                />
            )
        } else if (grapher.isTimeScatter) {
            return (
                <TimeScatter
                    bounds={bounds.padTop(20).padBottom(15)}
                    grapher={grapher}
                />
            )
        } else if (grapher.isLineChart) {
            // Switch to bar chart if a single year is selected
            return grapher.lineChartTransform.isSingleYear ? (
                <DiscreteBarChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    grapher={grapher}
                />
            ) : (
                <LineChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    chart={grapher}
                />
            )
        } else if (grapher.isStackedArea) {
            return (
                <StackedAreaChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    grapher={grapher}
                />
            )
        } else if (grapher.isDiscreteBar) {
            return (
                <DiscreteBarChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    grapher={grapher}
                />
            )
        } else if (grapher.isStackedBar) {
            return (
                <StackedBarChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    grapher={grapher}
                />
            )
        } else {
            return null
        }
    }

    render() {
        return (
            <ChartLayoutView layout={this.layout}>
                {this.renderChart()}
            </ChartLayoutView>
        )
    }
}
