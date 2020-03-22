import * as React from "react"
import * as ReactDOM from "react-dom"

import { CovidTable, CovidTableProps } from "./CovidTable"
import { CovidTableColumnKey } from "./CovidTableColumns"
import { SortOrder, CovidSortKey } from "./CovidTypes"

type Measure = "cases" | "deaths"

const CASE_THRESHOLD = 20
const DEATH_THRESHOLD = 5

const propsByMeasure: Record<Measure, Partial<CovidTableProps>> = {
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
        },
        filter: d =>
            d.location.indexOf("International") === -1 &&
            (d.latest && d.latest.totalCases !== undefined
                ? d.latest.totalCases >= CASE_THRESHOLD
                : false),
        note: `Countries with less than ${CASE_THRESHOLD} confirmed
            cases are not shown. Cases from the Diamond Princess
            cruise ship are also not shown since these numbers are
            no longer changing over time.`
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
        },
        filter: d =>
            d.location.indexOf("International") === -1 &&
            (d.latest && d.latest.totalDeaths !== undefined
                ? d.latest.totalDeaths >= DEATH_THRESHOLD
                : false),
        note: `Countries with less than ${DEATH_THRESHOLD} confirmed
            deaths are not shown. Deaths from the Diamond Princess
            cruise ship are also not shown since these numbers are
            no longer changing over time.`
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
