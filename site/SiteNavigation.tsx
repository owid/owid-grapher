import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { faListUl } from "@fortawesome/free-solid-svg-icons/faListUl"
import {
    NewsletterSubscriptionContext,
    NewsletterSubscriptionForm,
} from "./NewsletterSubscription.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
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

export enum Menu {
    Topics = "topics",
    Resources = "resources",
    About = "about",
    Subscribe = "subscribe",
    Search = "search",
}

export const SiteNavigation = ({ baseUrl }: { baseUrl: string }) => {
    const [menu, setActiveMenu] = React.useState<Menu | null>(Menu.Search)
    const [categorizedTopics, setCategorizedTopics] = useState<
        CategoryWithEntries[]
    >([])

    const closeOverlay = () => {
        setActiveMenu(null)
    }

    const toggleMenu = (root: Menu) => {
        if (menu === root) {
            closeOverlay()
        } else {
            setActiveMenu(root)
        }
    }

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

    const isActiveMobileMenu =
        menu !== null &&
        [Menu.Topics, Menu.Resources, Menu.About].includes(menu)

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
                            toggle={() => toggleMenu(Menu.Topics)}
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
                                        toggle={() => toggleMenu(Menu.Topics)}
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
                                        toggle={() =>
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
                                        toggle={() => toggleMenu(Menu.About)}
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
                                isActive={menu === Menu.Search}
                                onClick={() => setActiveMenu(Menu.Search)}
                            />
                            {menu !== Menu.Search && (
                                <button
                                    onClick={() => toggleMenu(Menu.Search)}
                                    data-track-note="mobile-search-button"
                                    className="mobile-search hide-lg-up"
                                >
                                    <FontAwesomeIcon icon={faSearch} />
                                </button>
                            )}

                            <SiteNavigationToggle
                                isActive={menu === Menu.Subscribe}
                                toggle={() => toggleMenu(Menu.Subscribe)}
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
