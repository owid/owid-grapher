import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faRss, faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons"
import {
    faTwitter,
    faFacebookSquare,
    faInstagram,
    faThreads,
} from "@fortawesome/free-brands-svg-icons"
import React from "react"
import {
    NewsletterSubscriptionContext,
    NewsletterSubscriptionForm,
} from "../../NewsletterSubscription.js"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"

export interface HomepageProps {
    totalCharts: number
    totalTopics: number
}

export const Homepage = (props: HomepageProps): JSX.Element => {
    const baseUrl = BAKED_BASE_URL
    const { totalCharts, totalTopics } = props

    return (
        <div>
            <section className="homepage-masthead">
                <div className="wrapper">
                    <h1>
                        Research and data to make progress against the world’s
                        largest problems
                    </h1>
                    <p>
                        {totalCharts} charts across {totalTopics} topics
                    </p>
                    <p>All free: open access and open source</p>
                </div>
            </section>

            <section className="homepage-coverage">
                <div className="wrapper">
                    <div className="inner-wrapper">
                        <div className="owid-row owid-spacing--4">
                            <div className="owid-col owid-col--lg-2">
                                <section>
                                    <h3 className="align-center">
                                        Trusted in{" "}
                                        <strong>research and media</strong>
                                    </h3>
                                    <a
                                        href="/about/coverage#coverage"
                                        className="coverage-link"
                                        data-track-note="homepage_trust"
                                    >
                                        <img
                                            src={`${baseUrl}/media-logos-wide.png`}
                                            alt="Two rows of logos from the publications that have used Our World In Data's content: Science, Nature, PNAS, Royal Statistics Society, BBC, The New York Times, CNN, Financial Times, The Guardian, The Wall Street Journal, CNBC, The Washington Post, and Vox"
                                            width={1200}
                                            height={109}
                                        />
                                        <div className="hover-note">
                                            <p>
                                                Find out how our work is used by
                                                journalists and researchers
                                            </p>
                                        </div>
                                    </a>
                                </section>
                                <section>
                                    <h3 className="align-center">
                                        Used in <strong>teaching</strong>
                                    </h3>
                                    <a
                                        href="/about/coverage#teaching"
                                        className="coverage-link"
                                        data-track-note="homepage_trust"
                                    >
                                        <picture>
                                            <source
                                                type="image/avif"
                                                srcSet={`${baseUrl}/university-logos-wide.avif`}
                                            />
                                            <img
                                                src={`${baseUrl}/university-logos-wide.png`}
                                                alt="A row of logos for universites that have used Our World In Data's content: Harvard, Stanford, Berkeley, Cambridge, Oxford, and MIT"
                                                width={1200}
                                                height={57}
                                            />
                                        </picture>
                                        <div className="hover-note">
                                            <p>
                                                Find out how our work is used in
                                                teaching
                                            </p>
                                        </div>
                                    </a>
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="homepage-posts">
                <div className="wrapper">
                    <div className="owid-row">
                        <div className="owid-col flex-row"></div>
                    </div>
                </div>
            </section>

            <section className="homepage-subscribe" id="subscribe">
                <div className="wrapper">
                    <div className="owid-row">
                        <div className="owid-col owid-col--lg-2 flex-row">
                            <div className="newsletter-subscription">
                                <div className="box">
                                    <h2>Subscribe to our newsletter</h2>
                                    <div className="root">
                                        {/* Hydrated in runSiteTools() */}
                                        <NewsletterSubscriptionForm
                                            context={
                                                NewsletterSubscriptionContext.Homepage
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="owid-col owid-col--lg-1">
                            <div className="homepage-subscribe--social-media">
                                <div className="shaded-box">
                                    <h2>Follow us</h2>
                                    <div className="list">
                                        <a
                                            href="https://twitter.com/ourworldindata"
                                            className="list-item"
                                            title="Twitter"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            data-track-note="homepage_follow_us"
                                        >
                                            <div className="icon">
                                                <FontAwesomeIcon
                                                    icon={faTwitter}
                                                />
                                            </div>
                                            <div className="label">Twitter</div>
                                        </a>
                                        <a
                                            href="https://facebook.com/ourworldindata"
                                            className="list-item"
                                            title="Facebook"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            data-track-note="homepage_follow_us"
                                        >
                                            <div className="icon">
                                                <FontAwesomeIcon
                                                    icon={faFacebookSquare}
                                                />
                                            </div>
                                            <div className="label">
                                                Facebook
                                            </div>
                                        </a>
                                        <a
                                            href="https://www.instagram.com/ourworldindata/"
                                            className="list-item"
                                            title="Instagram"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            data-track-note="homepage_follow_us"
                                        >
                                            <div className="icon">
                                                <FontAwesomeIcon
                                                    icon={faInstagram}
                                                />
                                            </div>
                                            <div className="label">
                                                Instagram
                                            </div>
                                        </a>
                                        <a
                                            href="https://www.threads.net/@ourworldindata"
                                            className="list-item"
                                            title="Threads"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            data-track-note="homepage_follow_us"
                                        >
                                            <div className="icon">
                                                <FontAwesomeIcon
                                                    icon={faThreads}
                                                />
                                            </div>
                                            <div className="label">Threads</div>
                                        </a>
                                        <a
                                            href="/feed"
                                            className="list-item"
                                            title="RSS"
                                            target="_blank"
                                            data-track-note="homepage_follow_us"
                                        >
                                            <div className="icon">
                                                <FontAwesomeIcon icon={faRss} />
                                            </div>
                                            <div className="label">
                                                RSS Feed
                                            </div>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="homepage-projects">
                <div className="wrapper">
                    <div className="list">
                        <a
                            href="/sdgs"
                            className="list-item"
                            data-track-note="homepage_projects"
                        >
                            <div className="icon-left">
                                <picture>
                                    <source
                                        srcSet={`${baseUrl}/sdg-wheel.avif`}
                                        type="image/avif"
                                    />
                                    <img
                                        src={`${baseUrl}/sdg-wheel.png`}
                                        alt="SDG Tracker logo"
                                        loading="lazy"
                                    />
                                </picture>
                            </div>
                            <div className="content">
                                <h3>Sustainable Development Goals Tracker</h3>
                                <p>
                                    Is the world on track to reach the
                                    Sustainable Development Goals?
                                </p>
                            </div>
                            <div className="icon-right">
                                <FontAwesomeIcon icon={faExternalLinkAlt} />
                            </div>
                        </a>
                        <a
                            href="/teaching"
                            className="list-item"
                            data-track-note="homepage_projects"
                        >
                            <div className="icon-left">
                                <img
                                    src={`${baseUrl}/teaching-hub.svg`}
                                    alt="Teaching Hub logo"
                                    loading="lazy"
                                />
                            </div>
                            <div className="content">
                                <h3>Teaching Hub</h3>
                                <p>
                                    Slides, research, and visualizations for
                                    teaching and learning about global
                                    development
                                </p>
                            </div>
                            <div className="icon-right">
                                <FontAwesomeIcon icon={faExternalLinkAlt} />
                            </div>
                        </a>
                    </div>
                </div>
            </section>
        </div>
    )
}
