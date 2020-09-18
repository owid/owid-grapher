import * as React from "react"
import { LineChart } from "grapher/lineCharts/LineChart"
import { SynthesizeOwidTable } from "owidTable/OwidTable"
import { basicGdpGrapher } from "grapher/test/samples"

export default {
    title: "LineChart",
    component: LineChart,
}

export const Default = () => {
    const table = SynthesizeOwidTable()
    const options = { baseFontSize: 16, entityType: "Country", table }

    const options2 = basicGdpGrapher() // Todo: remove. Shuold be able to create a LineChart without a Grapher.

    return (
        <svg width={640} height={480}>
            <LineChart options={options2} />
        </svg>
    )
}
