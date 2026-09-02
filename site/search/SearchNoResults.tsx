import React from "react"
import { IconDefinition, faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export const SearchNoResults = ({
    heading = "There are no results for this query.",
    subtitle = (
        <p className="body-3-medium">
            Try searching for something else or removing some filters.
        </p>
    ),
    className = "span-cols-12 col-start-2",
    icon = faSearch,
}: {
    heading?: string
    subtitle?: React.ReactNode
    className?: string
    icon?: IconDefinition
} = {}) => {
    return (
        <div className={`search-no-results ${className}`}>
            <FontAwesomeIcon className="search-no-results__icon" icon={icon} />
            <h2 className="body-1-regular">{heading}</h2>
            {subtitle}
        </div>
    )
}
