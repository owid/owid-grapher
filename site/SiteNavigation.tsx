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

export const SiteNavigation = ({ baseUrl }: { baseUrl: string }) => {
    return (
        <div className="site-navigation-bar">
            <div className="site-logos">
                <div className="logo-owid">
                    <a href="/">
                        Our World
                        <br /> in Data
                    </a>
                </div>
                <div className="logos-wrapper">
                    <a
                        href="https://www.oxfordmartin.ox.ac.uk/global-development"
                        className="oxford-logo"
                    >
                        <img
                            src={`${baseUrl}/oms-logo.svg`}
                            alt="Oxford Martin School logo"
                        />
                    </a>
                    <a
                        href="https://global-change-data-lab.org/"
                        className="gcdl-logo"
                    >
                        <img
                            src={`${baseUrl}/gcdl-logo.svg`}
                            alt="Global Change Data Lab logo"
                        />
                    </a>
                </div>
            </div>
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
