import React from "react"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { SearchEmptyState } from "./SearchEmptyState.js"

export const SearchNoResults = ({
    heading = "There are no results for this query.",
    subtitle = (
        <p className="body-3-medium">
            Try searching for something else or removing some filters.
        </p>
    ),
}: {
    heading?: string
    subtitle?: React.ReactNode
} = {}) => {
    return (
        <SearchEmptyState
            icon={faSearch}
            heading={heading}
            subtitle={subtitle}
        />
    )
}
