import * as React from "react"
import { useEffect } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
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
    shouldScrollIntoView = false,
    menuRef,
}: {
    ariaLabel: string
    children: React.ReactNode
    isActive: boolean
    onToggle: () => void
    withCaret?: boolean
    dropdown?: React.ReactNode
    className?: string
    shouldScrollIntoView?: boolean
    menuRef?: React.RefObject<HTMLDivElement | null>
}) => {
    useEffect(() => {
        if (shouldScrollIntoView && isActive && menuRef?.current) {
            const menuBottomOffset =
                menuRef.current.getBoundingClientRect().bottom

            // put bottom of the menu at the bottom of the viewport if it's offscreen
            if (menuBottomOffset > window.innerHeight) {
                window.scrollTo({
                    top: menuBottomOffset - window.innerHeight + window.scrollY,
                    behavior: "smooth",
                })
            }
        }
    }, [shouldScrollIntoView, menuRef, isActive])

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
