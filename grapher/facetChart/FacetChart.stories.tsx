import * as React from "react"
import { FacetChart } from "./FacetChart"
import { basicGdpGrapher, basicScatterGrapher } from "grapher/test/samples"
import { ChartTypeName } from "grapher/core/GrapherConstants"

export default {
    title: "FacetChart",
    component: FacetChart,
    argTypes: {
        chartTypeName: { control: "select", defaultValue: "LineChart" },
        number: { control: "range", defaultValue: 4 },
        padding: { control: "range", defaultValue: 1 },
        width: {
            control: { type: "range", min: 50, max: 2000 },
            defaultValue: 640,
        },
        height: {
            control: { type: "range", min: 50, max: 2000 },
            defaultValue: 480,
        },
        chart: { control: null },
    },
}

export const Default = (args: any) => {
    const chartType: ChartTypeName = args.chartTypeName || "LineChart"
    const grapher = chartType.includes("Scatter")
        ? basicScatterGrapher()
        : basicGdpGrapher()

    return (
        <FacetChart
            number={args.number}
            chartTypeName={chartType}
            grapher={grapher}
            width={args.width}
            height={args.height}
            padding={args.padding}
        />
    )
}

// One chart for France. One for Germany. One line for pop. One line for GDP.
export const OneChartPerCountry = (args: any) => {
    const grapher = basicGdpGrapher()

    return (
        <FacetChart
            number={2}
            chartTypeName="LineChart"
            grapher={grapher}
            width={args.width}
            height={args.height}
            padding={args.padding}
        />
    )
}
