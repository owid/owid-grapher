import * as React from "react"
import * as ReactDOM from "react-dom"

import { CovidTable } from "./CovidTable"

export function runCovid() {
    const element = document.getElementById("covid-table-embed")
    if (element) {
        ReactDOM.render(<CovidTable />, element)
    }
}
