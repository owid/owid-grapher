import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import * as React from "react"
import { NewsletterSubscriptionContext } from "../../newsletter.js"
import { NewsletterSubscriptionForm } from "../../NewsletterSubscription.js"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import { OwidGdocHomepageContent } from "@ourworldindata/types"
import { RSS_FEEDS, SOCIALS } from "../../SiteConstants.js"
import { getAllTopicsInArea } from "@ourworldindata/utils"
import { AttachmentsContext } from "../AttachmentsContext.js"

export interface HomepageProps {
    content: OwidGdocHomepageContent
}

const SocialSection = () => {
    return (
        <section
            className="grid grid-cols-12-full-width span-cols-14"
            id="subscribe"
        >
            <section className="homepage-social-ribbon span-cols-8 col-start-2 span-sm-cols-12 col-sm-start-2">
                <h2 className="h2-semibold">Subscribe to our newsletters</h2>
                <div id="newsletter-subscription-root">
                    {/* Hydrated in runSiteTools() */}
                    <NewsletterSubscriptionForm
                        context={NewsletterSubscriptionContext.Homepage}
                    />
                </div>
            </section>
            <section className="homepage-social-ribbon__social-media span-cols-4 span-sm-cols-12 col-sm-start-2">
                <h2 className="h2-semibold">Follow us</h2>
                <ul className="homepage-social-ribbon__social-list grid">
                    {[...SOCIALS, ...RSS_FEEDS].map(({ title, url, icon }) => (
                        <li key={title}>
                            <a
                                href={url}
                                className="list-item"
                                title={title}
                                target="_blank"
                                rel="noopener"
                                data-track-note="homepage_follow_us"
                            >
                                <span className="icon">
                                    <FontAwesomeIcon icon={icon} />
                                </span>
                                <span className="label">{title}</span>
                            </a>
                        </li>
                    ))}
                </ul>
            </section>
        </section>
    )
}

const AllTopicsSection = () => {
    const { homepageMetadata } = React.useContext(AttachmentsContext)
    if (!homepageMetadata) return null
    const { tagGraph } = homepageMetadata
    if (!tagGraph) return null

    // We have to flatten the areas because we can't nest <ul> elements and have them render correctly
    const flattenedAreas = tagGraph.children.map((area) => ({
        ...area,
        children: getAllTopicsInArea(area),
    }))

    return (
        <section
            id="all-topics"
            className="grid span-cols-12 col-start-2 homepage-topics-section"
        >
            <h2 className="h2-bold span-cols-12">All our topics</h2>
            <p className="body-2-regular span-cols-12">
                All our data, research, and writing — topic by topic.
            </p>
            {flattenedAreas.map((area) => (
                <section
                    key={area.name}
                    className="homepage-topic span-cols-12"
                >
                    <h2 className="homepage-topic__topic-name h3-bold">
                        {area.name}
                    </h2>
                    <ul className="homepage-topic__topic-list display-3-regular">
                        {area.children.map(({ slug, name }) => (
                            <li
                                className="homepage-topic__topic-entry"
                                key={`topic-entry-${slug}`}
                            >
                                <a href={`/${slug}`}>{name}</a>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </section>
    )
}

export const Homepage = (props: HomepageProps): React.ReactElement => {
    const { content } = props

    return (
        <div className="grid grid-cols-12-full-width">
            <ArticleBlocks blocks={content.body} />
            <SocialSection />
            <AllTopicsSection />
        </div>
    )
}
