import React, { useState } from "react"
import ReactDOM from "react-dom"
import Select, { ValueType } from "react-select"
import { countries } from "utils/countries"
import { covidCountryProfileRootPath } from "site/server/covid/CovidConstants"
import { asArray } from "utils/client/react-select"

interface CountrySelectOption {
    label: string
    value: string
}

const CovidSearchCountry = () => {
    const [isLoading, setIsLoading] = useState(false)
    return (
        <Select
            options={countries.map(c => {
                return { label: c.name, value: c.slug }
            })}
            onChange={(selected: ValueType<CountrySelectOption>) => {
                setIsLoading(true)
                window.location.href = `${covidCountryProfileRootPath}/${
                    asArray(selected)[0].value
                }`
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
