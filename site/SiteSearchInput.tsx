import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark"
import classnames from "classnames"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"

export const SiteSearchInput = ({
    isActive,
    toggle,
}: {
    isActive: boolean
    toggle: VoidFunction
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
                onClick={!isActive ? toggle : undefined}
                className={classnames({ active: isActive })}
            />
            <div className="icon">
                {isActive ? (
                    <SiteNavigationToggle toggle={toggle} isActive={true}>
                        <FontAwesomeIcon icon={faXmark} />
                    </SiteNavigationToggle>
                ) : (
                    <FontAwesomeIcon icon={faSearch} />
                )}
            </div>
        </form>
    )
}
