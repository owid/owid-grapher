import { useState } from "react"
import Select from "react-select"
import { countries, sortBy } from "@ourworldindata/utils"
import { SiteAnalytics } from "./SiteAnalytics.js"

interface CountrySelectOption {
    label: string
    value: string
}

const analytics = new SiteAnalytics()

export default function SearchCountry(props: {
    countryProfileRootPath: string
}) {
    const [isLoading, setIsLoading] = useState(false)
    const sorted = sortBy(countries, "name")
    return (
        <Select
            options={sorted.map((c) => {
                return { label: c.name, value: c.slug }
            })}
            onChange={(selected: CountrySelectOption | null) => {
                if (selected) {
                    analytics.logCountryProfileSearch(selected.value)
                    setIsLoading(true)
                    window.location.href = `${props.countryProfileRootPath}/${selected.value}`
                }
            }}
            isLoading={isLoading}
            placeholder="Search for a country..."
        />
    )
}
