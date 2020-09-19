import * as React from "react"
import { DataTable } from "./DataTable"
import { SynthesizeOwidTable } from "owidTable/OwidTable"

export default {
    title: "DataTable",
    component: DataTable,
}

const table = SynthesizeOwidTable({ timeRange: [1950, 2010], countryCount: 7 })

const options = {
    table,
}

export const Default = () => {
    return <DataTable options={options} />
}

export const WithTimeTolerance = () => {
    // grapher.timeDomain = [2009, 2017]
    // Todo: how can I get this to show a closest time popup?
    return <DataTable options={options} />
}
