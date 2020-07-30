import React, { useState } from "react"
import ReactDOM from "react-dom"
import Select, { ValueType } from "react-select"
import { countries } from "utils/countries"
import { covidCountryProfileRootPath } from "site/server/covid/CovidConstants"
import { asArray } from "utils/client/react-select"
import { Analytics } from "../Analytics"
import { sortBy } from "charts/Util"
import { co2CountryProfilePath } from "site/server/views/SiteSubnavigation"

interface CountrySelectOption {
    label: string
    value: string
}

const countryProfileTypes = [
    {
        selector: ".wp-block-covid-search-country",
        rootPath: covidCountryProfileRootPath
    },
    {
        selector: ".wp-block-co2-search-country",
        rootPath: co2CountryProfilePath
    }
]

const SearchCountry = (props: { countryProfileRootPath: string }) => {
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
                window.location.href = `${props.countryProfileRootPath}/${country}`
            }}
            isLoading={isLoading}
            placeholder="Search for a country..."
        />
    )
}

export function runSearchCountry() {
    countryProfileTypes.forEach(profileType => {
        const elements = Array.from(
            document.querySelectorAll(profileType.selector)
        )
        elements.forEach(element => {
            ReactDOM.render(
                <SearchCountry countryProfileRootPath={profileType.rootPath} />,
                element
            )
        })
    })
}

export default SearchCountry
