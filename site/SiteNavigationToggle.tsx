import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons"
import classnames from "classnames"

export const SiteNavigationToggle = ({
    children,
    isActive,
    onToggle,
    withCaret = false,
    dropdown,
    className,
}: {
    children: React.ReactNode
    isActive: boolean
    onToggle: () => void
    withCaret?: boolean
    dropdown?: React.ReactNode
    className?: string
}) => {
    return (
        <div className={classnames("SiteNavigationToggle", className)}>
            <button
                onClick={onToggle}
                className={classnames({ active: isActive })}
            >
                {children}
                {withCaret && (
                    <FontAwesomeIcon
                        style={{ marginLeft: "8px" }}
                        icon={isActive ? faCaretUp : faCaretDown}
                    />
                )}
            </button>
            {isActive && dropdown && (
                <div className="SiteNavigationToggle__dropdown">{dropdown}</div>
            )}
        </div>
    )
}
