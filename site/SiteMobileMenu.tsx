import { useRef, useState } from "react"
import { CategoryWithEntries } from "@ourworldindata/utils"
import classnames from "classnames"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"
import { Menu } from "./SiteConstants.js"
import { SiteAbout } from "./SiteAbout.js"
import { SiteResources } from "./SiteResources.js"
import { SiteMobileCategory } from "./SiteMobileCategory.js"

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

    const menuRef = useRef<HTMLDivElement>(null)

    const toggleCategory = (category: CategoryWithEntries) => {
        if (activeCategory === category) {
            setActiveCategory(null)
        } else {
            setActiveCategory(category)
        }
    }

    return (
        <div ref={menuRef} className={classnames("SiteMobileMenu", className)}>
            <ul>
                <li>
                    <span className="section__header">Browse by topic</span>
                    <ul className="section__dropdown--topics">
                        {topics.map((category) => (
                            <SiteMobileCategory
                                key={category.slug}
                                category={category}
                                isActive={activeCategory === category}
                                toggleCategory={toggleCategory}
                            />
                        ))}
                    </ul>
                </li>
                <li>
                    <a href="/data" className="section__header">
                        Data
                    </a>
                </li>
                <li>
                    <a href="/data-insights" className="section__header">
                        Insights
                    </a>
                </li>
                <li>
                    <SiteNavigationToggle
                        ariaLabel="Toggle resources menu"
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
                        shouldScrollIntoView
                        menuRef={menuRef}
                    >
                        Resources
                    </SiteNavigationToggle>
                </li>
                <li>
                    <SiteNavigationToggle
                        ariaLabel="Toggle about menu"
                        isActive={menu === Menu.About}
                        onToggle={() =>
                            toggleMenu(
                                menu === Menu.About ? Menu.Topics : Menu.About
                            )
                        }
                        dropdown={<SiteAbout />}
                        withCaret={true}
                        className="SiteNavigationToggle--lvl1"
                        shouldScrollIntoView
                        menuRef={menuRef}
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
