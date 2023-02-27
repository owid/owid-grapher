import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { faListUl } from "@fortawesome/free-solid-svg-icons/faListUl"
import {
    NewsletterSubscriptionContext,
    NewsletterSubscriptionForm,
} from "./NewsletterSubscription.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { SiteNavigationTopics } from "./SiteNavigationTopics.js"
import { SiteLogos } from "./SiteLogos.js"
import { CategoryWithEntries } from "@ourworldindata/utils"
import { SiteResources } from "./SiteResources.js"
import { SiteAbout } from "./SiteAbout.js"
import { SiteSearchInput } from "./SiteSearchInput.js"
import { faBars } from "@fortawesome/free-solid-svg-icons/faBars"
import { SiteMobileMenu } from "./SiteMobileMenu.js"
import { SiteNavigationToggle } from "./SiteNavigationToggle.js"
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark"
import { faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons/faEnvelopeOpenText"
import classnames from "classnames"
import { useTriggerOnEscape } from "./hooks.js"

export enum Menu {
    Topics = "topics",
    Resources = "resources",
    About = "about",
    Subscribe = "subscribe",
    Search = "search",
}

export const SiteNavigation = ({ baseUrl }: { baseUrl: string }) => {
    const [menu, setActiveMenu] = React.useState<Menu | null>(null)
    const [categorizedTopics, setCategorizedTopics] = useState<
        CategoryWithEntries[]
    >([])
    const [query, setQuery] = React.useState<string>("")

    const isActiveMobileMenu =
        menu !== null &&
        [Menu.Topics, Menu.Resources, Menu.About].includes(menu)

    const closeOverlay = () => {
        setActiveMenu(null)
        setQuery("")
    }

    const toggleMenu = (root: Menu) => {
        if (menu === root) {
            closeOverlay()
        } else {
            setActiveMenu(root)
        }
    }

    // Open / close overlay when query changes
    useEffect(() => {
        if (query) {
            setActiveMenu(Menu.Search)
        } else {
            closeOverlay()
        }
    }, [query])

    useEffect(() => {
        const fetchCategorizedTopics = async () => {
            const response = await fetch("/headerMenu.json", {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                },
            })
            const json = await response.json()
            setCategorizedTopics(json.categories)
        }
        fetchCategorizedTopics()
    }, [])

    useTriggerOnEscape(closeOverlay)

    return (
        <>
            {menu && <div className="overlay" onClick={closeOverlay} />}
            <div className="site-navigation">
                <div className="wrapper">
                    <div
                        className={classnames("site-navigation-bar", {
                            "search-active": menu === Menu.Search,
                        })}
                    >
                        <SiteNavigationToggle
                            isActive={isActiveMobileMenu}
                            onToggle={() => toggleMenu(Menu.Topics)}
                            className="mobile-menu-toggle hide-sm-up"
                            dropdown={
                                <SiteMobileMenu
                                    topics={categorizedTopics}
                                    className="hide-sm-up"
                                />
                            }
                        >
                            <FontAwesomeIcon
                                icon={isActiveMobileMenu ? faXmark : faBars}
                            />
                        </SiteNavigationToggle>
                        <SiteLogos baseUrl={baseUrl} />
                        <nav className="site-primary-links hide-sm-only">
                            <ul>
                                <li>
                                    <SiteNavigationToggle
                                        isActive={menu === Menu.Topics}
                                        onToggle={() => toggleMenu(Menu.Topics)}
                                        dropdown={
                                            <SiteNavigationTopics
                                                onClose={closeOverlay}
                                                topics={categorizedTopics}
                                                className="hide-sm-only"
                                            />
                                        }
                                        className="topics"
                                    >
                                        <FontAwesomeIcon
                                            icon={faListUl}
                                            style={{ marginRight: "8px" }}
                                        />
                                        Browse by topic
                                    </SiteNavigationToggle>
                                </li>
                                <li>
                                    <a href="/blog">Latest</a>
                                </li>
                                <li className="with-relative-dropdown">
                                    <SiteNavigationToggle
                                        isActive={menu === Menu.Resources}
                                        onToggle={() =>
                                            toggleMenu(Menu.Resources)
                                        }
                                        dropdown={<SiteResources />}
                                        withCaret={true}
                                    >
                                        Resources
                                    </SiteNavigationToggle>
                                </li>
                                <li className="with-relative-dropdown">
                                    <SiteNavigationToggle
                                        isActive={menu === Menu.About}
                                        onToggle={() => toggleMenu(Menu.About)}
                                        dropdown={<SiteAbout />}
                                        withCaret={true}
                                    >
                                        About
                                    </SiteNavigationToggle>
                                </li>
                            </ul>
                        </nav>
                        <div className="site-search-cta">
                            <SiteSearchInput
                                query={query}
                                isActive={menu === Menu.Search || !!query}
                                setQuery={setQuery}
                                onClose={closeOverlay}
                                onToggle={() => toggleMenu(Menu.Search)}
                            />
                            <SiteNavigationToggle
                                isActive={menu === Menu.Subscribe}
                                onToggle={() => toggleMenu(Menu.Subscribe)}
                                dropdown={
                                    <NewsletterSubscriptionForm
                                        context={
                                            NewsletterSubscriptionContext.Floating
                                        }
                                    />
                                }
                                className="newsletter-subscription"
                            >
                                <span className="hide-lg-down">Subscribe</span>
                                <FontAwesomeIcon
                                    className="hide-lg-up"
                                    icon={faEnvelopeOpenText}
                                />
                            </SiteNavigationToggle>
                            <a
                                href="/donate"
                                className="donate"
                                data-track-note="header-navigation"
                            >
                                Donate
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export const runSiteNavigation = (baseUrl: string) => {
    ReactDOM.render(
        <SiteNavigation baseUrl={baseUrl} />,
        document.querySelector(".site-navigation-root")
    )
}
