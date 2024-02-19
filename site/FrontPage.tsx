import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { faRss, faAngleRight } from "@fortawesome/free-solid-svg-icons"
import {
    faTwitter,
    faFacebookSquare,
    faInstagram,
    faThreads,
} from "@fortawesome/free-brands-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    NewsletterSubscriptionForm,
    NewsletterSubscriptionContext,
} from "../site/NewsletterSubscription.js"
import { IndexPost } from "@ourworldindata/utils"
import PostCard from "./PostCard/PostCard.js"

export const FrontPage = (props: {
    totalCharts: number
    baseUrl: string
    featuredWork: IndexPost[]
}) => {
    const { totalCharts, baseUrl, featuredWork } = props

    // Structured data for google
    const structuredMarkup = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        url: baseUrl,
        potentialAction: {
            "@type": "SearchAction",
            target: `${baseUrl}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
        },
    }

    return (
        <html>
            <Head canonicalUrl={baseUrl} baseUrl={baseUrl}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(structuredMarkup),
                    }}
                />
            </Head>
            <body className="FrontPage">
                <SiteHeader baseUrl={baseUrl} />

                <section className="homepage-masthead">
                    <div className="wrapper">
                        <h1>
                            Research and data to make progress against the
                            world’s largest problems
                        </h1>
                        <p>{totalCharts} charts across 297 topics</p>
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
                                                alt="Logos of the publications that have used our content"
                                                width={1200}
                                                height={109}
                                            />
                                            <div className="hover-note">
                                                <p>
                                                    Find out how our work is
                                                    used by journalists and
                                                    researchers
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
                                                    alt="Logos of the universities that have used our content"
                                                    width={1200}
                                                    height={57}
                                                />
                                            </picture>
                                            <div className="hover-note">
                                                <p>
                                                    Find out how our work is
                                                    used in teaching
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
                            <div className="owid-col flex-row">
                                <div className="homepage-posts--explainers">
                                    <h2 className="heading-latest">Featured</h2>
                                    <ul>
                                        {featuredWork.map((post) => (
                                            <li key={post.slug}>
                                                <PostCard
                                                    post={post}
                                                    hideDate={true}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="see-all">
                                        <a
                                            href="/latest"
                                            data-track-note="homepage_see_all_explainers"
                                        >
                                            <div className="label">
                                                See all of our latest work
                                            </div>
                                            <div className="icon">
                                                <FontAwesomeIcon
                                                    icon={faAngleRight}
                                                />
                                            </div>
                                        </a>
                                    </div>
                                </div>
                            </div>
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
                                        <h2 className="h2-bold">Follow us</h2>
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
                                                <div className="label">
                                                    Twitter
                                                </div>
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
                                                <div className="label">
                                                    Threads
                                                </div>
                                            </a>
                                            <a
                                                href="/feed"
                                                className="list-item"
                                                title="RSS"
                                                target="_blank"
                                                data-track-note="homepage_follow_us"
                                            >
                                                <div className="icon">
                                                    <FontAwesomeIcon
                                                        icon={faRss}
                                                    />
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

                <SiteFooter baseUrl={baseUrl} />
            </body>
        </html>
    )
}
