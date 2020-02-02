import { computed } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"
import { Bounds } from "./Bounds"
import { ChartConfig } from "./ChartConfig"
import { ChartLayout, ChartLayoutView } from "./ChartLayout"
import { ChartView } from "./ChartView"
import { DiscreteBarChart } from "./DiscreteBarChart"
import { LineChart } from "./LineChart"
import { LoadingChart } from "./LoadingChart"
import { ScatterPlot } from "./ScatterPlot"
import { SlopeChart } from "./SlopeChart"
import { StackedArea } from "./StackedArea"
import { StackedBarChart } from "./StackedBarChart"
import { TimeScatter } from "./TimeScatter"

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

        if (!chart.data.isReady) return <LoadingChart bounds={bounds} />
        else if (chart.isSlopeChart)
            return <SlopeChart bounds={bounds.padTop(20)} chart={chart} />
        else if (chart.isScatter)
            return (
                <ScatterPlot
                    bounds={bounds.padTop(20).padBottom(15)}
                    config={chart}
                    isStatic={chartView.isExport}
                />
            )
        else if (chart.isTimeScatter)
            return (
                <TimeScatter
                    bounds={bounds.padTop(20).padBottom(15)}
                    config={chart}
                    isStatic={chartView.isExport}
                />
            )
        else if (chart.isLineChart)
            // Switch to bar chart if a single year is selected
            return chart.lineChart.isSingleYear ? (
                <DiscreteBarChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    chart={chart}
                />
            ) : (
                <LineChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    chart={chart}
                />
            )
        else if (chart.isStackedArea)
            return (
                <StackedArea
                    bounds={bounds.padTop(20).padBottom(15)}
                    chart={chart}
                />
            )
        else if (chart.isDiscreteBar)
            return (
                <DiscreteBarChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    chart={chart}
                />
            )
        else if (chart.isStackedBar)
            return (
                <StackedBarChart
                    bounds={bounds.padTop(20).padBottom(15)}
                    chart={chart}
                />
            )
        else return null
    }

    render() {
        return (
            <ChartLayoutView layout={this.layout}>
                {this.renderChart()}
            </ChartLayoutView>
        )
    }
}
