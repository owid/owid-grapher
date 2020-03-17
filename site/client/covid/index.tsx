import * as React from "react"
import * as ReactDOM from "react-dom"

import { CovidTable, CovidTableProps } from "./CovidTable"
import { CovidTableColumnKey } from "./CovidTableColumns"
import { SortOrder, CovidSortKey } from "./CovidTypes"

type Measure = "cases" | "deaths"

const propsByMeasure: Record<Measure, CovidTableProps> = {
    cases: {
        columns: [
            CovidTableColumnKey.location,
            CovidTableColumnKey.daysToDoubleCases,
            CovidTableColumnKey.totalCases,
            CovidTableColumnKey.newCases
        ],
        mobileColumns: [
            CovidTableColumnKey.location,
            CovidTableColumnKey.daysToDoubleCases
        ],
        defaultState: {
            sortKey: CovidSortKey.totalCases,
            sortOrder: SortOrder.desc
        }
    },
    deaths: {
        columns: [
            CovidTableColumnKey.location,
            CovidTableColumnKey.daysToDoubleDeaths,
            CovidTableColumnKey.totalDeaths,
            CovidTableColumnKey.newDeaths
        ],
        mobileColumns: [
            CovidTableColumnKey.location,
            CovidTableColumnKey.daysToDoubleDeaths
        ],
        defaultState: {
            sortKey: CovidSortKey.totalDeaths,
            sortOrder: SortOrder.desc
        }
    }
}

export function runCovid() {
    const elements = Array.from(
        document.querySelectorAll("*[data-covid-table], #covid-table-embed")
    )
    elements.forEach(element => {
        const measure: Measure =
            element.getAttribute("data-measure") === "deaths"
                ? "deaths"
                : "cases"
        ReactDOM.render(<CovidTable {...propsByMeasure[measure]} />, element)
    })
}
