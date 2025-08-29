import { useRef, useState } from "react"
import { TagGraphNode, TagGraphRoot } from "@ourworldindata/utils"
import classnames from "classnames"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"
import { Menu } from "./SiteConstants.js"
import { SiteAbout } from "./SiteAbout.js"
import { SiteResources } from "./SiteResources.js"
import { SiteMobileArea } from "./SiteMobileArea.js"
import { SEARCH_BASE_PATH } from "./search/searchUtils.js"

export const SiteMobileMenu = ({
    tagGraph,
    menu,
    toggleMenu,
    className,
}: {
    tagGraph: TagGraphRoot | null
    menu: Menu | null
    toggleMenu: (menu: Menu) => void
    className?: string
}) => {
    const [activeArea, setActiveArea] = useState<TagGraphNode | null>(null)
    const menuRef = useRef<HTMLDivElement>(null)
    const toggleArea = (area: TagGraphNode) => {
        if (activeArea === area) {
            setActiveArea(null)
        } else {
            setActiveArea(area)
        }
    }

    return (
        <div ref={menuRef} className={classnames("SiteMobileMenu", className)}>
            <ul>
                <li>
                    <span className="section__header">Browse by topic</span>
                    <ul className="section__dropdown--topics">
                        {tagGraph?.children.map((area) => (
                            <SiteMobileArea
                                key={area.id}
                                area={area}
                                isActive={activeArea === area}
                                toggleArea={toggleArea}
                            />
                        ))}
                    </ul>
                </li>
                <li>
                    <a href={SEARCH_BASE_PATH} className="section__header">
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
