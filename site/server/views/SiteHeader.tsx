import * as React from "react"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { faBars } from "@fortawesome/free-solid-svg-icons/faBars"
import { faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons/faEnvelopeOpenText"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { AlertBanner } from "./AlertBanner"

import { BAKED_BASE_URL } from "settings"

export interface SiteHeaderProps {
    hideAlertBanner: boolean
}

const DEFAULT_PROPS: SiteHeaderProps = {
    hideAlertBanner: false,
}

export const SiteHeader = (overrideProps: Partial<SiteHeaderProps>) => {
    const props: SiteHeaderProps = {
        ...DEFAULT_PROPS,
        ...overrideProps,
    }
    return (
        <>
            <header className="site-header">
                <div className="wrapper site-navigation-bar">
                    <div className="site-logo">
                        <a href="/">
                            Our World
                            <br /> in Data
                        </a>
                    </div>
                    <nav className="site-navigation">
                        <div className="topics-button-wrapper">
                            <a href="/#entries" className="topics-button">
                                <div className="label">
                                    Articles <br />
                                    <strong>by topic</strong>
                                </div>
                                <div className="icon">
                                    <svg width="12" height="6">
                                        <path
                                            d="M0,0 L12,0 L6,6 Z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                </div>
                            </a>
                        </div>
                        <div>
                            <div className="site-primary-navigation">
                                <form
                                    className="HeaderSearch"
                                    action="/search"
                                    method="GET"
                                >
                                    <input
                                        type="search"
                                        name="q"
                                        placeholder="Search..."
                                    />
                                    <div className="icon">
                                        <FontAwesomeIcon icon={faSearch} />
                                    </div>
                                </form>
                                <ul className="site-primary-links">
                                    <li>
                                        <a
                                            href="/blog"
                                            data-track-note="header-navigation"
                                        >
                                            Latest
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="/about"
                                            data-track-note="header-navigation"
                                        >
                                            About
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href="/donate"
                                            data-track-note="header-navigation"
                                        >
                                            Donate
                                        </a>
                                    </li>
                                </ul>
                            </div>
                            <div className="site-secondary-navigation">
                                <ul className="site-secondary-links">
                                    <li>
                                        <a
                                            href="/charts"
                                            data-track-note="header-navigation"
                                        >
                                            All charts
                                        </a>
                                    </li>
                                    {/* <li><a href="/teaching"  data-track-note="header-navigation">Teaching Hub</a></li> */}
                                    <li>
                                        <a
                                            href="https://sdg-tracker.org"
                                            data-track-note="header-navigation"
                                        >
                                            Sustainable Development Goals
                                            Tracker
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </nav>
                    <div className="header-logos-wrapper">
                        <a
                            href="https://www.oxfordmartin.ox.ac.uk/global-development"
                            className="oxford-logo"
                        >
                            <img
                                src={`${BAKED_BASE_URL}/oms-logo.svg`}
                                alt="Oxford Martin School logo"
                            />
                        </a>
                        <a
                            href="https://global-change-data-lab.org/"
                            className="gcdl-logo"
                        >
                            <img
                                src={`${BAKED_BASE_URL}/gcdl-logo-narrow.png`}
                                alt="Global Change Data Lab logo"
                            />
                        </a>
                    </div>
                    <div className="mobile-site-navigation">
                        <button data-track-note="mobile-search-button">
                            <FontAwesomeIcon icon={faSearch} />
                        </button>
                        <button data-track-note="mobile-newsletter-button">
                            <FontAwesomeIcon icon={faEnvelopeOpenText} />
                        </button>
                        <button data-track-note="mobile-hamburger-button">
                            <FontAwesomeIcon icon={faBars} />
                        </button>
                    </div>
                </div>
            </header>
            {!props.hideAlertBanner && <AlertBanner />}
        </>
    )
}
