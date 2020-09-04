import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { SlopeChart } from "charts/slopeCharts/SlopeChart"
import { Bounds } from "charts/utils/Bounds"
import { ChartConfig } from "./ChartConfig"
import { ChartView } from "./ChartView"
import { ScatterPlot } from "charts/scatterCharts/ScatterPlot"
import { LineChart } from "charts/lineCharts/LineChart"
import { StackedAreaChart } from "charts/areaCharts/StackedAreaChart"
import { DiscreteBarChart } from "charts/barCharts/DiscreteBarChart"
import { StackedBarChart } from "charts/barCharts/StackedBarChart"
import { ChartLayout, ChartLayoutView } from "./ChartLayout"
import { TimeScatter } from "charts/scatterCharts/TimeScatter"
import { LoadingOverlay } from "charts/loadingIndicator/LoadingOverlay"

@observer
export class ChartTab extends React.Component<{
    chart: ChartConfig
    chartView: ChartView
    bounds: Bounds
}> {
    @computed get layout() {
        const that = this
        return new ChartLayout({
            get chart() {
                return that.props.chart
            },
            get chartView() {
                return that.props.chartView
            },
            get bounds() {
                return that.props.bounds
            }
        })
    }

    renderChart() {
        const { chart, chartView } = this.props
        const bounds = this.layout.innerBounds

        if (!chart.isReady) {
            return <LoadingOverlay bounds={bounds} />
        } else if (chart.isSlopeChart) {
            return <SlopeChart bounds={bounds.padTop(20)} chart={chart} />
        } else if (chart.isScatter) {
            return (
                <ScatterPlot
                    bounds={bounds.padTop(20).padBottom(15)}
                    config={chart}
                />
            )
        } else if (chart.isTimeScatter) {
            return (
                <TimeScatter
                    bounds={bounds.padTop(20).padBottom(15)}
                    config={chart}
                />
            )
        } else if (chart.isLineChart) {
            // Switch to bar chart if a single year is selected
            return chart.lineChartTransform.isSingleYear ? (
                <DiscreteBarChart
                    chartView={chartView}
                    bounds={bounds.padTop(20).padBottom(15)}
                    chart={chart}
                />
            ) : (
                <LineChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    options={chart}
                />
            )
        } else if (chart.isStackedArea) {
            return (
                <StackedAreaChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    chart={chart}
                />
            )
        } else if (chart.isDiscreteBar) {
            return (
                <DiscreteBarChart
                    chartView={chartView}
                    bounds={bounds.padTop(20).padBottom(15)}
                    chart={chart}
                />
            )
        } else if (chart.isStackedBar) {
            return (
                <StackedBarChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    chart={chart}
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
