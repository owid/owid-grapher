import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons"
import { NavigationRoots } from "./SiteNavigation.js"
import classnames from "classnames"

export const SiteNavigationToggle = ({
    children,
    activeRoot,
    targetRoot,
    toggleActiveRoot,
    withCaret = false,
    dropdown,
    className,
}: {
    children: React.ReactNode
    activeRoot: NavigationRoots | null
    targetRoot: NavigationRoots
    toggleActiveRoot: (root: NavigationRoots) => void
    withCaret?: boolean
    dropdown?: React.ReactNode
    className?: string
}) => {
    return (
        <div className={classnames("SiteNavigationToggle", className)}>
            <button onClick={() => toggleActiveRoot(targetRoot)}>
                {children}
                {withCaret && (
                    <FontAwesomeIcon
                        style={{ marginLeft: "8px" }}
                        icon={
                            activeRoot === targetRoot ? faCaretUp : faCaretDown
                        }
                    />
                )}
            </button>
            {activeRoot === targetRoot && dropdown && (
                <div className="toggle-dropdown">{dropdown}</div>
            )}
        </div>
    )
}
