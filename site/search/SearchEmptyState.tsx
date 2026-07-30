import React from "react"
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

/**
 * Shared layout for the states where a search page has nothing to show: no
 * results for the query (`SearchNoResults`) and a failed search
 * (`SearchError`).
 *
 * On /search this is hidden unless it is the only child of the results
 * container (see SearchEmptyState.scss), so it never shows up next to result
 * sections that did return hits.
 */
export const SearchEmptyState = ({
    icon,
    heading,
    subtitle,
}: {
    icon: IconDefinition
    heading: string
    subtitle: React.ReactNode
}) => {
    return (
        <div className="search-empty-state span-cols-12 col-start-2">
            <FontAwesomeIcon
                className="search-empty-state__icon"
                icon={icon}
            />
            <h2 className="body-1-regular">{heading}</h2>
            {subtitle}
        </div>
    )
}
