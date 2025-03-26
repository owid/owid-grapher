import { faSearch } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import * as React from "react"

export const DataCatalogNoResults = () => {
    return (
        <div className="data-catalog-search-no-results span-cols-12 col-start-2">
            <FontAwesomeIcon
                className="data-catalog-search-no-results__icon"
                icon={faSearch}
            />
            <h2 className="body-1-regular">
                There are no results for this query.
            </h2>
            <p className="body-3-medium">
                Try searching for something else or removing some filters.
            </p>
        </div>
    )
}
