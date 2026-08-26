import * as React from "react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { TagGraphRoot } from "@ourworldindata/utils"
import classnames from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCaretDown, faTimes } from "@fortawesome/free-solid-svg-icons"
import { SiteAbout } from "./SiteAbout.js"
import { SiteResources } from "./SiteResources.js"
import { SiteMobileArea } from "./SiteMobileArea.js"
import { SEARCH_BASE_PATH } from "./search/searchUtils.js"
import { FeedbackForm } from "./Feedback.js"
import { Button, getPrefersReducedMotion } from "@ourworldindata/components"
import { buildLatestPagePath } from "./latest/latestUtils.js"
import { MOBILE_MENU_DETAILS_NAME } from "./SiteConstants.js"

export const SiteMobileMenu = ({
    tagGraph,
    className,
}: {
    tagGraph?: TagGraphRoot
    className?: string
}) => {
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!isFeedbackOpen) return
        document.documentElement.classList.add("no-scroll")
        return () => {
            document.documentElement.classList.remove("no-scroll")
        }
    }, [isFeedbackOpen])

    const scrollMenuIntoView = (
        event: React.ToggleEvent<HTMLDetailsElement>
    ) => {
        if (event.newState !== "open" || !menuRef.current) return
        const menuBottomOffset = menuRef.current.getBoundingClientRect().bottom

        // put bottom of the menu at the bottom of the viewport if it's offscreen
        if (menuBottomOffset > window.innerHeight) {
            window.scrollTo({
                top: menuBottomOffset - window.innerHeight + window.scrollY,
                behavior: getPrefersReducedMotion() ? "auto" : "smooth",
            })
        }
    }

    return (
        <div ref={menuRef} className={classnames("SiteMobileMenu", className)}>
            <ul>
                <li>
                    <span className="section__header">Browse by topic</span>
                    <ul className="section__dropdown--topics">
                        {tagGraph?.children.map((area) => (
                            <SiteMobileArea key={area.id} area={area} />
                        ))}
                    </ul>
                </li>
                <li>
                    <a href={SEARCH_BASE_PATH} className="section__header">
                        Data
                    </a>
                </li>
                <li>
                    <a href={buildLatestPagePath()} className="section__header">
                        Latest
                    </a>
                </li>
                <li>
                    <details
                        name={MOBILE_MENU_DETAILS_NAME}
                        onToggle={scrollMenuIntoView}
                    >
                        <summary className="section__header">
                            Resources
                            <FontAwesomeIcon
                                className="SiteMobileMenu__caret"
                                icon={faCaretDown}
                            />
                        </summary>
                        <div className="SiteMobileMenu__dropdown">
                            <SiteResources />
                        </div>
                    </details>
                </li>
                <li>
                    <details
                        name={MOBILE_MENU_DETAILS_NAME}
                        onToggle={scrollMenuIntoView}
                    >
                        <summary className="section__header">
                            About
                            <FontAwesomeIcon
                                className="SiteMobileMenu__caret"
                                icon={faCaretDown}
                            />
                        </summary>
                        <div className="SiteMobileMenu__dropdown">
                            <SiteAbout />
                        </div>
                    </details>
                </li>
                <li>
                    <a href="/donate" className="donate">
                        Donate
                    </a>
                </li>
                <li>
                    <Button
                        theme="outline-vermillion"
                        className="send-feedback-button"
                        dataTrackNote="page_open_feedback_mobile_menu"
                        icon={null}
                        onClick={() => setIsFeedbackOpen(true)}
                        text="Send feedback"
                    ></Button>
                </li>
            </ul>
            {isFeedbackOpen &&
                createPortal(
                    <div className="SiteMobileFeedbackModal">
                        <div
                            className="SiteMobileFeedbackModal__overlay"
                            onClick={() => setIsFeedbackOpen(false)}
                        />
                        <div className="SiteMobileFeedbackModal__box">
                            <button
                                className="SiteMobileFeedbackModal__close"
                                aria-label="Close feedback form"
                                onClick={() => setIsFeedbackOpen(false)}
                            >
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                            <FeedbackForm
                                autofocus={false}
                                onClose={() => setIsFeedbackOpen(false)}
                            />
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    )
}
