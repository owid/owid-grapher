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
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import { OwidGdocHomepageContent } from "@ourworldindata/types"

export interface HomepageProps {
    content: OwidGdocHomepageContent
}

export const Homepage = (props: HomepageProps): JSX.Element => {
    const { content } = props

    return (
        <div className="grid grid-cols-12-full-width">
            <ArticleBlocks blocks={content.body} />
            <section
                className="grid grid-cols-12-full-width span-cols-14"
                id="subscribe"
            >
                <section className="homepage-social-ribbon span-cols-8 col-start-2">
                    <h2 className="h2-semibold">Subscribe to our newsletter</h2>
                    <div id="newsletter-subscription-root">
                        {/* Hydrated in runSiteTools() */}
                        <NewsletterSubscriptionForm
                            context={NewsletterSubscriptionContext.Homepage}
                        />
                    </div>
                </section>
                <section className="homepage-social-ribbon__social-media span-cols-4">
                    <h2 className="h2-semibold">Follow us</h2>
                    <ul className="homepage-social-ribbon__social-list">
                        <li>
                            <a
                                href="https://twitter.com/ourworldindata"
                                className="list-item"
                                title="Twitter"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-track-note="homepage_follow_us"
                            >
                                <span className="icon">
                                    <FontAwesomeIcon icon={faTwitter} />
                                </span>
                                <span className="label">Twitter</span>
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://facebook.com/ourworldindata"
                                className="list-item"
                                title="Facebook"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-track-note="homepage_follow_us"
                            >
                                <span className="icon">
                                    <FontAwesomeIcon icon={faFacebookSquare} />
                                </span>
                                <span className="label">Facebook</span>
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://www.instagram.com/ourworldindata/"
                                className="list-item"
                                title="Instagram"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-track-note="homepage_follow_us"
                            >
                                <span className="icon">
                                    <FontAwesomeIcon icon={faInstagram} />
                                </span>
                                <span className="label">Instagram</span>
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://www.threads.net/@ourworldindata"
                                className="list-item"
                                title="Threads"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-track-note="homepage_follow_us"
                            >
                                <span className="icon">
                                    <FontAwesomeIcon icon={faThreads} />
                                </span>
                                <span className="label">Threads</span>
                            </a>
                        </li>
                        <li>
                            <a
                                href="/feed"
                                className="list-item"
                                title="RSS"
                                target="_blank"
                                data-track-note="homepage_follow_us"
                            >
                                <span className="icon">
                                    <FontAwesomeIcon icon={faRss} />
                                </span>
                                <span className="label">RSS Feed</span>
                            </a>
                        </li>
                    </ul>
                </section>
            </section>
        </div>
    )
}
