import * as React from "react"
import { CountryFacet, FacetChart } from "./FacetChart"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { SynthesizeOwidTable } from "owidTable/OwidTable"
import { Grapher } from "grapher/core/Grapher"

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
    const table = SynthesizeOwidTable()
    const options = new Grapher({
        table,
        dimensions: [
            { slug: "GDP", property: "y", variableId: 1 },
            { slug: "Population", property: "x", variableId: 2 },
        ],
    })
    table.selectAll()

    return (
        <FacetChart
            number={args.number}
            chartTypeName={chartType}
            options={options}
            width={args.width}
            height={args.height}
            padding={args.padding}
        />
    )
}

// One chart for France. One for Germany. One line for pop. One line for GDP.
export const OneChartPerCountry = (args: any) => {
    const table = SynthesizeOwidTable({ countryCount: 9 })
    const options = new Grapher({
        table,
        dimensions: [
            { slug: "GDP", property: "y", variableId: 1 },
            { slug: "Population", property: "x", variableId: 2 },
        ],
    })
    const chartType: ChartTypeName = args.chartTypeName || "LineChart"

    return (
        <CountryFacet
            chartTypeName={chartType}
            options={options}
            width={args.width}
            height={args.height}
            padding={args.padding}
        />
    )
}
