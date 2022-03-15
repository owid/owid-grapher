import React, { useState } from "react"
import ReactDOM from "react-dom"
import { ReactSelect as Select } from "../clientUtils/import-shims.js"
import { countries } from "../clientUtils/countries.js"
import { sortBy } from "../clientUtils/Util.js"
import { countryProfileSpecs } from "../site/countryProfileProjects.js"
import { SiteAnalytics } from "./SiteAnalytics.js"

interface CountrySelectOption {
    label: string
    value: string
}

const analytics = new SiteAnalytics()

const SearchCountry = (props: { countryProfileRootPath: string }) => {
    const [isLoading, setIsLoading] = useState(false)
    const sorted = sortBy(countries, "name")
    return (
        <Select
            options={sorted.map((c) => {
                return { label: c.name, value: c.slug }
            })}
            onChange={(selected: CountrySelectOption | null) => {
                if (selected) {
                    analytics.logCovidCountryProfileSearch(selected.value)
                    setIsLoading(true)
                    window.location.href = `${props.countryProfileRootPath}/${selected.value}`
                }
            }}
            isLoading={isLoading}
            placeholder="Search for a country..."
        />
    )
}

export function runSearchCountry() {
    const searchElements = document.querySelectorAll(
        ".wp-block-search-country-profile"
    )
    searchElements.forEach((element) => {
        const project = element.getAttribute("data-project")
        if (project) {
            const profileSpec = countryProfileSpecs.find(
                (spec) => spec.project === project
            )
            if (profileSpec) {
                ReactDOM.render(
                    <SearchCountry
                        countryProfileRootPath={profileSpec.rootPath}
                    />,
                    element
                )
            }
        }
    })
}

export default SearchCountry
