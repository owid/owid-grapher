import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { faListUl } from "@fortawesome/free-solid-svg-icons/faListUl"
import {
    NewsletterSubscription,
    NewsletterSubscriptionContext,
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

export enum NavigationRoots {
    Topics = "topics",
    // Latest = "latest",
    Resources = "resources",
    About = "about",
}

export const SiteNavigation = ({ baseUrl }: { baseUrl: string }) => {
    const [activeRoot, setActiveRoot] = React.useState<NavigationRoots | null>(
        NavigationRoots.Topics
    )
    const [categorizedTopics, setCategorizedTopics] = useState<
        CategoryWithEntries[]
    >([])
    const [showMobileSearch, setShowMobileSearch] = useState(false)

    const closeOverlay = () => {
        setActiveRoot(null)
    }

    const toggleActiveRoot = (root: NavigationRoots) => {
        if (activeRoot === root) {
            closeOverlay()
        } else {
            setActiveRoot(root)
        }
    }

    const onToggleMobileSearch = () => {
        setShowMobileSearch(!showMobileSearch)
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

    return (
        <>
            {activeRoot && <div className="overlay" onClick={closeOverlay} />}
            <div className="site-navigation">
                <div className="wrapper">
                    <div className="site-navigation-bar">
                        <SiteNavigationToggle
                            activeRoot={activeRoot}
                            targetRoot={NavigationRoots.Topics}
                            toggleActiveRoot={toggleActiveRoot}
                            className="mobile-menu-toggle hide-sm-up"
                            dropdown={
                                <SiteMobileMenu
                                    topics={categorizedTopics}
                                    className="hide-sm-up"
                                />
                            }
                        >
                            <FontAwesomeIcon icon={faBars} />
                        </SiteNavigationToggle>
                        <SiteLogos baseUrl={baseUrl} />
                        <nav className="site-primary-links hide-sm-only">
                            <ul>
                                <li>
                                    <SiteNavigationToggle
                                        activeRoot={activeRoot}
                                        targetRoot={NavigationRoots.Topics}
                                        toggleActiveRoot={toggleActiveRoot}
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
                                <li className="toggle-wrapper">
                                    <SiteNavigationToggle
                                        activeRoot={activeRoot}
                                        toggleActiveRoot={toggleActiveRoot}
                                        targetRoot={NavigationRoots.Resources}
                                        dropdown={<SiteResources />}
                                        withCaret={true}
                                    >
                                        Resources
                                    </SiteNavigationToggle>
                                </li>
                                <li className="toggle-wrapper">
                                    <SiteNavigationToggle
                                        activeRoot={activeRoot}
                                        toggleActiveRoot={toggleActiveRoot}
                                        targetRoot={NavigationRoots.About}
                                        dropdown={<SiteAbout />}
                                        withCaret={true}
                                    >
                                        About
                                    </SiteNavigationToggle>
                                </li>
                            </ul>
                        </nav>
                        {activeRoot === NavigationRoots.Topics && (
                            <SiteNavigationTopics
                                onClose={closeOverlay}
                                topics={categorizedTopics}
                                className="hide-sm-only"
                            />
                        )}
                        <div className="site-search-cta">
                            <div className="search-input-wrapper hide-md-down">
                                <SiteSearchInput />
                            </div>
                            <button
                                onClick={onToggleMobileSearch}
                                data-track-note="mobile-search-button"
                                className="mobile-search hide-md-up"
                            >
                                <FontAwesomeIcon icon={faSearch} />
                            </button>

                            <NewsletterSubscription
                                context={NewsletterSubscriptionContext.Floating}
                            />
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
            {showMobileSearch && (
                <div className="hide-md-up" style={{ width: "100%" }}>
                    <SiteSearchInput />
                </div>
            )}
        </>
    )
}

export const runSiteNavigation = (baseUrl: string) => {
    ReactDOM.render(
        <SiteNavigation baseUrl={baseUrl} />,
        document.querySelector(".site-navigation-root")
    )
}
