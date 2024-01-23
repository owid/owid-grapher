import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"

export const SiteNavigationToggle = ({
    ariaLabel,
    children,
    isActive,
    onToggle,
    withCaret = false,
    dropdown,
    className,
}: {
    ariaLabel: string
    children: React.ReactNode
    isActive: boolean
    onToggle: () => void
    withCaret?: boolean
    dropdown?: React.ReactNode
    className?: string
}) => {
    return (
        <div
            className={cx("SiteNavigationToggle", className, {
                active: isActive,
            })}
        >
            <button
                aria-label={ariaLabel}
                onClick={onToggle}
                className={cx("SiteNavigationToggle__button", {
                    active: isActive,
                })}
            >
                {children}
                {withCaret && (
                    <FontAwesomeIcon
                        className="SiteNavigationToggle__caret"
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
