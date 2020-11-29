import * as React from "react"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"

// IMPORTANT NOTE:
// This page is only used in development.
// It is not intended to be exposed to the public.

export const CovidPage = (props: { baseUrl: string }) => (
    <html>
        <Head
            canonicalUrl={`${props.baseUrl}/covid`}
            pageTitle="COVID-19"
        ></Head>
        <body className="CovidPage">
            <SiteHeader baseUrl={props.baseUrl} />
            <main>
                <article className="page no-sidebar large-banner">
                    <div className="offset-header">
                        <header className="article-header">
                            <h1 className="entry-title">COVID-19</h1>
                        </header>
                    </div>

                    <div className="content-wrapper">
                        <div className="offset-content">
                            <div className="content-and-footnotes">
                                <div className="article-content">
                                    <section>
                                        <h2 id="cases-of-covid-19">
                                            <a
                                                className="deep-link"
                                                href="#cases-of-covid-19"
                                            ></a>
                                            Cases of COVID-19
                                        </h2>
                                        <div className="wp-block-columns is-style-sticky-right">
                                            <div className="wp-block-column">
                                                <h4 id="what-we-would-want-to-know">
                                                    <a
                                                        className="deep-link"
                                                        href="#what-we-would-want-to-know"
                                                    ></a>
                                                    What we would want to know
                                                </h4>
                                            </div>
                                            <div className="wp-block-column"></div>
                                        </div>
                                        <div className="wp-block-columns is-style-sticky-right">
                                            <div className="wp-block-column">
                                                <p>
                                                    We would want to know how
                                                    many cases of COVID-19 and
                                                    where. We want to know the
                                                    number of total cases.
                                                </p>
                                                <p>
                                                    This however is not known.{" "}
                                                </p>
                                                <p>
                                                    What we know is the number
                                                    of <em>confirmed</em> cases
                                                    and the number of{" "}
                                                    <em>suspected</em> cases.
                                                    The number of known cases is
                                                    lower than the number of{" "}
                                                    <em>total</em> cases.
                                                </p>
                                            </div>
                                            <div className="wp-block-column"></div>
                                        </div>
                                        <div className="wp-block-columns is-style-sticky-right">
                                            <div className="wp-block-column">
                                                <div
                                                    data-covid-table
                                                    data-measure="deaths"
                                                ></div>
                                            </div>
                                            <div className="wp-block-column"></div>
                                        </div>
                                        <div className="wp-block-columns is-style-sticky-right">
                                            <div className="wp-block-column">
                                                <div
                                                    data-covid-table
                                                    data-measure="cases"
                                                ></div>
                                            </div>
                                            <div className="wp-block-column"></div>
                                        </div>
                                        <div className="wp-block-columns is-style-sticky-right">
                                            <div className="wp-block-column">
                                                <div
                                                    data-covid-table
                                                    data-measure="tests"
                                                ></div>
                                            </div>
                                            <div className="wp-block-column"></div>
                                        </div>
                                        <div className="wp-block-columns is-style-sticky-right">
                                            <div
                                                data-covid-table
                                                data-measure="deathsAndCases"
                                            ></div>
                                        </div>
                                        <div className="wp-block-columns is-style-sticky-right">
                                            <div className="wp-block-column">
                                                <h4 id="what-we-do-know">
                                                    <a
                                                        className="deep-link"
                                                        href="#what-we-do-know"
                                                    ></a>
                                                    What we do know
                                                </h4>
                                            </div>
                                            <div className="wp-block-column"></div>
                                        </div>
                                        <div className="wp-block-columns is-style-sticky-right">
                                            <div className="wp-block-column">
                                                <p>
                                                    The table and the chart show{" "}
                                                    <strong>
                                                        the number of confirmed
                                                        cases
                                                    </strong>
                                                    .
                                                </p>
                                                <p>
                                                    This is the data published
                                                    by the World Health
                                                    Organization (WHO) in their
                                                    daily Situation Reports. We
                                                    brought this data together
                                                    and make it accessible in a
                                                    clean dataset here for
                                                    everyone to use.
                                                </p>
                                            </div>
                                            <div className="wp-block-column"></div>
                                        </div>
                                        <div className="wp-block-columns is-style-sticky-right">
                                            <div className="wp-block-column">
                                                <h4 id="what-do-the-known-cases-tell-us-about-the-number-of-total-cases">
                                                    <a
                                                        className="deep-link"
                                                        href="#what-do-the-known-cases-tell-us-about-the-number-of-total-cases"
                                                    ></a>
                                                    What do the known cases tell
                                                    us about the number of total
                                                    cases?
                                                </h4>
                                            </div>
                                            <div className="wp-block-column"></div>
                                        </div>
                                        <div className="wp-block-columns is-style-sticky-right">
                                            <div className="wp-block-column">
                                                <p>
                                                    Further down – here – we
                                                    discuss that.
                                                </p>
                                            </div>
                                            <div className="wp-block-column"></div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    </div>
                </article>
            </main>
            <SiteFooter />
        </body>
    </html>
)
