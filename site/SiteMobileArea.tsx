import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCaretDown } from "@fortawesome/free-solid-svg-icons"
import { SiteNavigationTopic } from "./SiteNavigationTopic.js"
import { TagGraphNode, getAllChildrenOfArea } from "@ourworldindata/utils"
import { getPrefersReducedMotion } from "@ourworldindata/components"
import { MOBILE_MENU_DETAILS_NAME } from "./SiteConstants.js"

export const SiteMobileArea = ({ area }: { area: TagGraphNode }) => {
    const scrollAreaIntoView = (
        event: React.ToggleEvent<HTMLDetailsElement>
    ) => {
        if (event.newState !== "open") return
        event.currentTarget.scrollIntoView({
            behavior: getPrefersReducedMotion() ? "auto" : "smooth",
        })
    }

    return (
        <li className="SiteMobileArea">
            <details
                name={MOBILE_MENU_DETAILS_NAME}
                onToggle={scrollAreaIntoView}
            >
                <summary className="SiteMobileArea__summary">
                    {area.name}
                    <FontAwesomeIcon
                        className="SiteMobileMenu__caret"
                        icon={faCaretDown}
                    />
                </summary>
                <div className="SiteMobileMenu__dropdown">
                    <ul>
                        {getAllChildrenOfArea(area)
                            .filter((topic) => topic.slug)
                            .map((topic) => (
                                <SiteNavigationTopic
                                    key={topic.id}
                                    topic={topic}
                                />
                            ))}
                    </ul>
                </div>
            </details>
        </li>
    )
}
