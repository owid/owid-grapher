import React from "react"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { faBars } from "@fortawesome/free-solid-svg-icons/faBars"
import { faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons/faEnvelopeOpenText"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { AlertBanner } from "./AlertBanner.js"
import {
    NewsletterSubscription,
    NewsletterSubscriptionContext,
} from "./NewsletterSubscription.js"

interface SiteHeaderProps {
    hideAlertBanner?: boolean
    baseUrl: string
}

export const SiteHeader = (props: SiteHeaderProps) => (
    <>
        <header className="site-header">
            <div className="wrapper site-navigation-bar">
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
                                src={`${props.baseUrl}/oms-logo.svg`}
                                alt="Oxford Martin School logo"
                            />
                        </a>
                        <a
                            href="https://global-change-data-lab.org/"
                            className="gcdl-logo"
                        >
                            <img
                                src={`${props.baseUrl}/gcdl-logo.svg`}
                                alt="Global Change Data Lab logo"
                            />
                        </a>
                    </div>
                </div>
                <nav className="site-primary-links">
                    <ul>
                        <li>Browse by topic</li>
                        <li>
                            <a href="/blog" data-track-note="header-navigation">
                                Latest
                            </a>
                        </li>
                        <li>Resources</li>
                        <li>
                            <a
                                href="/about"
                                data-track-note="header-navigation"
                            >
                                About
                            </a>
                        </li>
                    </ul>
                </nav>
                <div className="site-search-cta">
                    <form
                        className="HeaderSearch"
                        action="/search"
                        method="GET"
                    >
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
                    <a href="/donate" data-track-note="header-navigation">
                        Donate
                    </a>
                </div>
            </div>
        </header>
        {props.hideAlertBanner !== true && <AlertBanner />}
    </>
)
)
