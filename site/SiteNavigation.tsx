import React from "react"
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

export const SiteNavigation = ({ baseUrl }: { baseUrl: string }) => {
    return (
        <div className="site-navigation-bar wrapper">
            <SiteLogos baseUrl={baseUrl} />
            <nav className="site-primary-links">
                <ul>
                    <li>
                        <button>
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
                        <button>
                            Resources
                            <FontAwesomeIcon
                                icon={faCaretDown}
                                style={{ marginLeft: "8px" }}
                            />
                        </button>
                    </li>
                    <li>
                        <button>
                            About
                            <FontAwesomeIcon
                                icon={faCaretDown}
                                style={{ marginLeft: "8px" }}
                            />
                        </button>
                    </li>
                </ul>
            </nav>
            <SiteNavigationTopics />
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
