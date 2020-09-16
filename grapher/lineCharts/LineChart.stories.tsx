import * as React from "react"
import "site/client/owid.scss"
import "grapher/core/grapher.scss"
import { LineChart } from "grapher/lineCharts/LineChart"
import { OwidTable } from "owidTable/OwidTable"
import { synthOwidTableCsv } from "owidTable/TableSynthesizer"
import { basicGdpGrapher } from "grapher/test/samples"

export default {
    title: "LineChart",
    component: LineChart,
}

export const Default = () => {
    const table = OwidTable.fromDelimited(synthOwidTableCsv())
    const options = { baseFontSize: 16, entityType: "Country", table }

    const options2 = basicGdpGrapher() // Todo: remove. Shuold be able to create a LineChart without a Grapher.

    return (
        <svg width={640} height={480}>
            <LineChart options={options2} />
        </svg>
    )
}
