import React, { useState } from "react"
import ReactDOM from "react-dom"
import Select, { ValueType } from "react-select"
import { countries } from "utils/countries"
import { covidCountryProfileRootPath } from "site/server/covid/CovidConstants"
import { asArray } from "utils/client/react-select"
import { Analytics } from "../Analytics"
import { sortBy } from "charts/Util"

interface CountrySelectOption {
    label: string
    value: string
}

const CovidSearchCountry = () => {
    const [isLoading, setIsLoading] = useState(false)
    const sorted = sortBy(countries, "name")
    return (
        <Select
            options={sorted.map(c => {
                return { label: c.name, value: c.slug }
            })}
            onChange={(selected: ValueType<CountrySelectOption>) => {
                const country = asArray(selected)[0].value
                Analytics.logCovidCountryProfileSearch(country)
                setIsLoading(true)
                window.location.href = `${covidCountryProfileRootPath}/${country}`
            }}
            isLoading={isLoading}
            placeholder="Search for a country..."
        />
    )
}

export function runCovidSearchCountry() {
    const elements = Array.from(
        document.querySelectorAll(".wp-block-covid-search-country")
    )
    elements.forEach(element => {
        ReactDOM.render(<CovidSearchCountry />, element)
    })
}

export default CovidSearchCountry
