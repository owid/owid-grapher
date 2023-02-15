import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"

export const SiteSearchInput = () => {
    return (
        <form className="SiteSearchInput" action="/search" method="GET">
            <input name="search" placeholder="Search for a topic or chart..." />
            <div className="icon">
                <FontAwesomeIcon icon={faSearch} />
            </div>
        </form>
    )
}
