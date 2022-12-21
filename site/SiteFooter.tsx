import React from "react"
import { webpackUrl } from "../site/webpackUtils.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight"
import { SiteFooterContext } from "@ourworldindata/utils"

interface SiteFooterProps {
    hideDonate?: boolean
    baseUrl: string
    context?: SiteFooterContext
}

export const SiteFooter = (props: SiteFooterProps) => (
    <>
        {!props.hideDonate && (
            <section className="donate-footer">
                <div className="wrapper">
                    <div className="owid-row flex-align-center">
                        <div className="owid-col owid-col--lg-3 owid-padding-bottom--sm-3">
                            <p>
                                Our World in Data is free and accessible for
                                everyone.
                            </p>
                            <p>Help us do this work by making a donation.</p>
                        </div>
                        <div className="owid-col owid-col--lg-1">
                            <a
                                href="/donate"
                                className="owid-button donate-button"
                                data-track-note="donate-footer"
                            >
                                <span className="label">Donate now</span>
                                <span className="icon">
                                    <FontAwesomeIcon icon={faAngleRight} />
                                </span>
                            </a>
                        </div>
                    </div>
                </div>
            </section>
        )}
        <footer className="site-footer">
            <div className="wrapper">
                <div className="owid-row">
                    <div className="owid-col owid-col--lg-1">
                        <ul>
                            <li>
                                <a
                                    href="/about"
                                    data-track-note="footer-navigation"
                                >
                                    About
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/about#contact"
                                    data-track-note="footer-navigation"
                                >
                                    Contact
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/feedback"
                                    data-track-note="footer-navigation"
                                >
                                    Feedback
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/jobs"
                                    data-track-note="footer-navigation"
                                >
                                    Jobs
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/funding"
                                    data-track-note="footer-navigation"
                                >
                                    Funding
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/about/how-to-use-our-world-in-data"
                                    data-track-note="footer-navigation"
                                >
                                    How to use
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/donate"
                                    data-track-note="footer-navigation"
                                >
                                    Donate
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/privacy-policy"
                                    data-track-note="footer-navigation"
                                >
                                    Privacy policy
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div className="owid-col owid-col--lg-1">
                        <ul>
                            <li>
                                <a
                                    href="/blog"
                                    data-track-note="footer-navigation"
                                >
                                    Latest work
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/charts"
                                    data-track-note="footer-navigation"
                                >
                                    All charts
                                </a>
                            </li>
                        </ul>
                        <ul>
                            <li>
                                <a
                                    href="https://twitter.com/OurWorldInData"
                                    data-track-note="footer-navigation"
                                >
                                    Twitter
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://www.facebook.com/OurWorldinData"
                                    data-track-note="footer-navigation"
                                >
                                    Facebook
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://www.instagram.com/ourworldindata/"
                                    data-track-note="footer-navigation"
                                >
                                    Instagram
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://github.com/owid"
                                    data-track-note="footer-navigation"
                                >
                                    GitHub
                                </a>
                            </li>
                            <li>
                                <a
                                    href="/feed"
                                    data-track-note="footer-navigation"
                                >
                                    RSS Feed
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div className="owid-col owid-col--lg-1">
                        <div className="logos">
                            <a
                                href="https://www.oxfordmartin.ox.ac.uk/global-development"
                                className="partner-logo"
                                data-track-note="footer-navigation"
                            >
                                <img
                                    src={`${props.baseUrl}/oms-logo.svg`}
                                    alt="Oxford Martin School logo"
                                    loading="lazy"
                                />
                            </a>
                            <a
                                href="/owid-at-ycombinator"
                                className="partner-logo"
                                data-track-note="footer-navigation"
                            >
                                <img
                                    src={`${props.baseUrl}/yc-logo.png`}
                                    alt="Y Combinator logo"
                                    loading="lazy"
                                />
                            </a>
                        </div>
                    </div>
                    <div className="owid-col flex-2">
                        <div className="legal">
                            <p>
                                Licenses: All visualizations, data, and articles
                                produced by Our World in Data are open access
                                under the{" "}
                                <a
                                    href="https://creativecommons.org/licenses/by/4.0/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Creative Commons BY license
                                </a>
                                . You have permission to use, distribute, and
                                reproduce these in any medium, provided the
                                source and authors are credited. All the
                                software and code that we write is open source
                                and made available via GitHub under the
                                permissive{" "}
                                <a
                                    href="https://github.com/owid/owid-grapher/blob/master/LICENSE.md "
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    MIT license
                                </a>
                                . All other material, including data produced by
                                third parties and made available by Our World in
                                Data, is subject to the license terms from the
                                original third-party authors.
                            </p>
                            <p>
                                Please consult our full{" "}
                                <a href="/about#legal">legal disclaimer</a>.
                            </p>
                            <p>
                                <a
                                    href="https://global-change-data-lab.org/"
                                    className="partner-logo gcdl-logo"
                                    data-track-note="footer-navigation"
                                >
                                    <img
                                        src={`${props.baseUrl}/gcdl-logo.svg`}
                                        alt="Global Change Data Lab logo"
                                        loading="lazy"
                                    />
                                </a>
                                Our World In Data is a project of the{" "}
                                <a href="https://global-change-data-lab.org/">
                                    Global Change Data Lab
                                </a>
                                , a registered charity in England and Wales
                                (Charity Number 1186433).
                            </p>
                            {/* <a href="/" className="owid-logo">Our World in Data</a> */}
                        </div>
                    </div>
                </div>
            </div>
            <div className="site-tools" />
            <script src="https://polyfill.io/v3/polyfill.min.js?features=es6,fetch,URL,IntersectionObserver,IntersectionObserverEntry,ResizeObserver" />
            <script src="http://localhost:8090/site/owid.entry.ts" />
            <script
                dangerouslySetInnerHTML={{
                    __html: `window.runSiteFooterScripts(${JSON.stringify(
                        props.context
                    )})`, // todo: gotta be a better way.
                }}
            />
        </footer>
    </>
)
