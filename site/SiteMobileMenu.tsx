import React, { useState } from "react"
import { CategoryWithEntries } from "@ourworldindata/utils"
import { allTopicsInCategory } from "./SiteNavigationTopics.js"
import { SiteNavigationTopic } from "./SiteNavigationTopic.js"
import classnames from "classnames"
import { SiteAbout } from "./SiteAbout.js"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"
import { Menu } from "./SiteNavigation.js"
import { SiteResources } from "./SiteResources.js"

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
                    <span className="topics__header">Browse by topic</span>
                    <ul className="topics__dropdown">
                        {topics.map((category) => (
                            <li key={category.slug}>
                                <SiteNavigationToggle
                                    isActive={activeCategory === category}
                                    onToggle={() => toggleCategory(category)}
                                    dropdown={
                                        <ul>
                                            {allTopicsInCategory(category).map(
                                                (topic) => (
                                                    <SiteNavigationTopic
                                                        key={topic.slug}
                                                        topic={topic}
                                                    />
                                                )
                                            )}
                                        </ul>
                                    }
                                    withCaret={true}
                                    className="SiteNavigationToggle--lvl2"
                                >
                                    {category.name}
                                </SiteNavigationToggle>
                            </li>
                        ))}
                    </ul>
                </li>
                <li>
                    <SiteNavigationToggle
                        isActive={menu === Menu.Resources}
                        onToggle={() =>
                            toggleMenu(
                                menu === Menu.Resources
                                    ? Menu.Topics
                                    : Menu.Resources
                            )
                        }
                        dropdown={<SiteResources />}
                        withCaret={true}
                        className="SiteNavigationToggle--lvl1"
                    >
                        Resources
                    </SiteNavigationToggle>
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
                        className="SiteNavigationToggle--lvl1"
                    >
                        About
                    </SiteNavigationToggle>
                </li>
                <li>
                    <a href="/donate" className="donate">
                        Donate
                    </a>
                </li>
            </ul>
        </div>
    )
}
