import * as React from "react"
import { CountryFacet } from "./FacetChart"
import { ChartTypeName } from "grapher/core/GrapherConstants"
import { SynthesizeOwidTable } from "coreTable/OwidTable"
import { ChartOptionsProvider } from "grapher/chart/ChartOptionsProvider"

export default {
    title: "CountryFacet",
    component: CountryFacet,
    argTypes: {
        chartTypeName: { control: "select", defaultValue: "LineChart" },
        countryCount: { control: "range", defaultValue: 4, min: 1, max: 200 },
    },
}

// One chart for France. One for Germany. One line for pop. One line for GDP.
export const Default = (args: any) => {
    const table = SynthesizeOwidTable({
        countryCount: (args.countryCount ?? 4) || 1,
    })
    const options: ChartOptionsProvider = {
        table,
        yColumns: [table.get("GDP")!],
        xColumn: table.get("Population"),
        baseFontSize: 8,
        hidePoints: true,
    }
    const chartType: ChartTypeName = args.chartTypeName || "LineChart"

    return <CountryFacet chartTypeName={chartType} options={options} />
}
