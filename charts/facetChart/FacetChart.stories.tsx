import * as React from "react"
import "site/client/owid.scss"
import "charts/core/chart.scss"
import { FacetChart } from "./FacetChart"
import { basicGdpChart, basicScatter } from "charts/test/samples"
import { ChartTypeName } from "charts/chart/ChartTypes"

export default {
    title: "FacetChart",
    component: FacetChart,
    argTypes: {
        chartTypeName: { control: "select", defaultValue: "LineChart" },
        number: { control: "range", defaultValue: 4 },
        padding: { control: "range", defaultValue: 1 },
        width: {
            control: { type: "range", min: 50, max: 2000 },
            defaultValue: 640
        },
        height: {
            control: { type: "range", min: 50, max: 2000 },
            defaultValue: 480
        },
        chart: { control: null }
    }
}

export const Default = (args: any) => {
    const chartType: ChartTypeName = args.chartTypeName
    const chart = chartType.includes("Scatter")
        ? basicScatter()
        : basicGdpChart()

    return (
        <FacetChart
            number={args.number}
            chartTypeName={chartType}
            chart={chart}
            width={args.width}
            height={args.height}
            padding={args.padding}
        />
    )
}
