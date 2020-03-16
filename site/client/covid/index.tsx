import * as React from "react"
import * as ReactDOM from "react-dom"

import { CovidTable } from "./CovidTable"
import { CovidTableColumnKey } from "./CovidTableColumns"

export function runCovid() {
    const element = document.getElementById("covid-table-embed")
    if (element) {
        ReactDOM.render(
            <CovidTable
                columns={[
                    CovidTableColumnKey.location,
                    CovidTableColumnKey.daysToDoubleCases,
                    CovidTableColumnKey.totalCases,
                    CovidTableColumnKey.newCases
                ]}
                mobileColumns={[
                    CovidTableColumnKey.location,
                    CovidTableColumnKey.daysToDoubleCases
                ]}
            />,
            element
        )
    }
}
