import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import classnames from "classnames"

export const SiteSearchInput = ({
    isActive,
    onClick,
}: {
    isActive: boolean
    onClick: VoidFunction
}) => {
    return (
        <form
            className={classnames("SiteSearchInput", { active: isActive })}
            action="/search"
            method="GET"
        >
            <input
                name="search"
                placeholder="Search for a topic or chart..."
                onClick={onClick}
                className={classnames({ active: isActive })}
            />
            <div className="icon">
                <FontAwesomeIcon icon={faSearch} />
            </div>
        </form>
    )
}
