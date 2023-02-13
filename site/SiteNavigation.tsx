import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { faListUl } from "@fortawesome/free-solid-svg-icons/faListUl"
import { faCaretDown } from "@fortawesome/free-solid-svg-icons/faCaretDown"
import {
    NewsletterSubscription,
    NewsletterSubscriptionContext,
} from "./NewsletterSubscription.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { SiteNavigationTopics } from "./SiteNavigationTopics.js"
import { SiteLogos } from "./SiteLogos.js"
import { CategoryWithEntries } from "@ourworldindata/utils"

enum NavigationRoots {
    Topics = "topics",
    // Latest = "latest",
    Resources = "resources",
    About = "about",
}

export const SiteNavigation = ({ baseUrl }: { baseUrl: string }) => {
    const [activeRoot, setActiveRoot] = React.useState<NavigationRoots | null>(
        null
    )
    const [categorizedTopics, setCategorizedTopics] = useState<
        CategoryWithEntries[]
    >([])

    const AllNavigationRoots = {
        [NavigationRoots.Topics]: (
            <SiteNavigationTopics topics={categorizedTopics} />
        ),
        [NavigationRoots.Resources]: <div>Resources</div>,
        [NavigationRoots.About]: <div>About</div>,
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
        <div className="site-navigation-bar wrapper">
            <SiteLogos baseUrl={baseUrl} />
            <nav className="site-primary-links">
                <ul>
                    <li>
                        <button
                            onClick={() =>
                                setActiveRoot(NavigationRoots.Topics)
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
                    <li>
                        <button
                            onClick={() =>
                                setActiveRoot(NavigationRoots.Resources)
                            }
                        >
                            Resources
                            <FontAwesomeIcon
                                icon={faCaretDown}
                                style={{ marginLeft: "8px" }}
                            />
                        </button>
                    </li>
                    <li>
                        <button
                            onClick={() => setActiveRoot(NavigationRoots.About)}
                        >
                            About
                            <FontAwesomeIcon
                                icon={faCaretDown}
                                style={{ marginLeft: "8px" }}
                            />
                        </button>
                    </li>
                </ul>
            </nav>
            {activeRoot && AllNavigationRoots[activeRoot]}
            <div className="site-search-cta">
                <form className="HeaderSearch" action="/search" method="GET">
                    <input
                        name="search"
                        placeholder="Search for a topic or chart..."
                    />
                    <div className="icon">
                        <FontAwesomeIcon icon={faSearch} />
                    </div>
                </form>
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
    )
}

export const runSiteNavigation = (baseUrl: string) => {
    ReactDOM.render(
        <SiteNavigation baseUrl={baseUrl} />,
        document.querySelector(".site-navigation-root")
    )
}
