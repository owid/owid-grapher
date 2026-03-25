import React from "react"
import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

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
        <div className="search-no-results span-cols-12 col-start-2">
            <FontAwesomeIcon
                className="search-no-results__icon"
                icon={faSearch}
            />
            <h2 className="body-1-regular">{heading}</h2>
            {subtitle}
        </div>
    )
}
