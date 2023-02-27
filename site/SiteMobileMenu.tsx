import React, { useState } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faAngleDown, faAngleUp } from "@fortawesome/free-solid-svg-icons"
import { CategoryWithEntries } from "@ourworldindata/utils"
import { allTopicsInCategory } from "./SiteNavigationTopics.js"
import { SiteNavigationTopic } from "./SiteNavigationTopic.js"
import classnames from "classnames"
import { SiteAbout } from "./SiteAbout.js"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"
import { Menu } from "./SiteNavigation.js"

export const SiteMobileMenu = ({
    topics,
    menu,
    toggleMenu,
    className,
}: {
    topics: CategoryWithEntries[]
    menu: Menu | null
    toggleMenu: (menu: Menu) => void
    className?: string
}) => {
    const [activeCategory, setActiveCategory] =
        useState<CategoryWithEntries | null>(null)

    const toggleCategory = (category: CategoryWithEntries) => {
        if (activeCategory === category) {
            setActiveCategory(null)
        } else {
            setActiveCategory(category)
        }
    }

    return (
        <div className={classnames("SiteMobileMenu", className)}>
            <ul>
                <li>
                    <span>Browse by topic</span>
                    <ul>
                        {topics.map((category) => (
                            <li
                                key={category.slug}
                                className={`category ${
                                    activeCategory === category
                                        ? "expanded"
                                        : ""
                                }`}
                            >
                                <a onClick={() => toggleCategory(category)}>
                                    <span className="label-wrapper">
                                        <span className="label">
                                            {category.name}
                                        </span>
                                    </span>
                                    <span className="icon">
                                        <FontAwesomeIcon
                                            icon={
                                                activeCategory === category
                                                    ? faAngleUp
                                                    : faAngleDown
                                            }
                                        />
                                    </span>
                                </a>
                                {activeCategory === category && (
                                    <div className="subcategory-menu">
                                        <ul>
                                            {allTopicsInCategory(
                                                activeCategory
                                            ).map((topic) => (
                                                <SiteNavigationTopic
                                                    key={topic.slug}
                                                    topic={topic}
                                                />
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </li>
                <li>
                    <SiteNavigationToggle
                        isActive={menu === Menu.About}
                        onToggle={() =>
                            toggleMenu(
                                menu === Menu.About ? Menu.Topics : Menu.About
                            )
                        }
                        dropdown={<SiteAbout />}
                        withCaret={true}
                    >
                        About
                    </SiteNavigationToggle>
                </li>
                <li>
                    <a href="/donate" data-track-note="header-navigation">
                        Donate
                    </a>
                </li>
            </ul>
        </div>
    )
}
