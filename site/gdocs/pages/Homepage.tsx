import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

import * as React from "react"
import { NewsletterSubscriptionContext } from "../../newsletter.js"
import { NewsletterSubscriptionForm } from "../../NewsletterSubscription.js"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import {
    CategoryWithEntries,
    EntryMeta,
    OwidGdocHomepageContent,
} from "@ourworldindata/types"
import {
    SiteNavigationStatic,
    RSS_FEEDS,
    SOCIALS,
} from "../../SiteConstants.js"

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
                <ul className="homepage-social-ribbon__social-list grid grid-cols-2 grid-md-cols-1">
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

type FlattenedCategory = EntryMeta & { isSubcategoryHeading?: boolean }

// We have to flatten the categories because it's not possible to inline wrap nested <ul> elements the way we'd like them to
const flattenCategories = (categories: CategoryWithEntries[]) =>
    categories.map((category) => {
        // First show any top-level entries that exist on the category
        const flattened: FlattenedCategory[] = [...category.entries]
        category.subcategories?.forEach((subcategory) => {
            // Then for each subcategory, show the subcategory heading and then its entries
            flattened.push({
                title: subcategory.name,
                slug: subcategory.slug,
                isSubcategoryHeading: true,
            })
            flattened.push(...subcategory.entries)
        })
        return { entries: flattened, name: category.name }
    })

const AllTopicsSection = () => {
    const flattenedCategories = flattenCategories(
        SiteNavigationStatic.categories
    )
    return (
        <section
            id="all-topics"
            className="grid span-cols-12 col-start-2 homepage-topics-section"
        >
            <h2 className="h2-bold span-cols-12">All our topics</h2>
            <p className="body-2-regular span-cols-12">
                All our data, research, and writing — topic by topic.
            </p>
            {flattenedCategories.map((category) => (
                <section
                    key={category.name}
                    className="homepage-topic span-cols-12"
                >
                    <h2 className="homepage-topic__topic-name h3-bold">
                        {category.name}
                    </h2>
                    <ul className="homepage-topic__topic-list display-3-regular">
                        {category.entries.map(
                            ({ slug, title, isSubcategoryHeading }) =>
                                isSubcategoryHeading ? (
                                    <li
                                        className="homepage-topic__subtopic"
                                        key={`subtopic-entry-${slug}`}
                                    >
                                        {title}:
                                    </li>
                                ) : (
                                    <li
                                        className="homepage-topic__topic-entry"
                                        key={`topic-entry-${slug}`}
                                    >
                                        <a href={`/${slug}`}>{title}</a>
                                    </li>
                                )
                        )}
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
