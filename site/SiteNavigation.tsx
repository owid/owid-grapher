import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { faListUl } from "@fortawesome/free-solid-svg-icons/faListUl"
import { faCaretDown } from "@fortawesome/free-solid-svg-icons/faCaretDown"
import { faCaretUp } from "@fortawesome/free-solid-svg-icons/faCaretUp"
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

enum NavigationRoots {
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
                        <SiteLogos baseUrl={baseUrl} />

                        <nav className="site-primary-links hide-sm-only">
                            <ul>
                                <li>
                                    <button
                                        onClick={() =>
                                            toggleActiveRoot(
                                                NavigationRoots.Topics
                                            )
                                        }
                                    >
                                        <FontAwesomeIcon
                                            icon={faListUl}
                                            style={{ marginRight: "8px" }}
                                        />
                                        Browse by topic
                                    </button>
                                </li>
                                <li>
                                    <a href="/blog">Latest</a>
                                </li>
                                <li className="prompt">
                                    <button
                                        onClick={() =>
                                            toggleActiveRoot(
                                                NavigationRoots.Resources
                                            )
                                        }
                                    >
                                        Resources
                                        <FontAwesomeIcon
                                            icon={
                                                activeRoot ===
                                                NavigationRoots.Resources
                                                    ? faCaretUp
                                                    : faCaretDown
                                            }
                                            style={{ marginLeft: "8px" }}
                                        />
                                    </button>
                                    {activeRoot ===
                                        NavigationRoots.Resources && (
                                        <SiteResources />
                                    )}
                                </li>
                                <li className="prompt">
                                    <button
                                        onClick={() =>
                                            toggleActiveRoot(
                                                NavigationRoots.About
                                            )
                                        }
                                    >
                                        About
                                        <FontAwesomeIcon
                                            icon={
                                                activeRoot ===
                                                NavigationRoots.About
                                                    ? faCaretUp
                                                    : faCaretDown
                                            }
                                            style={{ marginLeft: "8px" }}
                                        />
                                    </button>
                                    {activeRoot === NavigationRoots.About && (
                                        <SiteAbout />
                                    )}
                                </li>
                            </ul>
                        </nav>
                        {activeRoot === NavigationRoots.Topics && (
                            <SiteNavigationTopics
                                onClose={closeOverlay}
                                topics={categorizedTopics}
                            />
                        )}
                        <div className="site-search-cta">
                            <div
                                className="hide-lg-down"
                                style={{ width: "300px" }}
                            >
                                <SiteSearchInput />
                            </div>
                            <button
                                onClick={onToggleMobileSearch}
                                data-track-note="mobile-search-button"
                                className="mobile-search hide-lg-up"
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
                <div className="hide-lg-up" style={{ width: "100%" }}>
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
