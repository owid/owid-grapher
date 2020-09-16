import * as React from "react"
import "site/client/owid.scss"
import "grapher/core/grapher.scss"
import { LineChart } from "grapher/lineCharts/LineChart"
import { OwidTable } from "owidTable/OwidTable"
import { synthOwidTableCsv } from "owidTable/TableSynthesizer"

export default {
    title: "LineChart",
    component: LineChart,
}

export const Default = () => {
    const table = OwidTable.fromDelimited(synthOwidTableCsv())
    const options = { baseFontSize: 16, entityType: "Country", table }

    return (
        <svg width={640} height={480}>
            <LineChart options={options} />
        </svg>
    )
}
