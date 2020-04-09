import * as settings from "settings"
import * as React from "react"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { CategoryWithEntries, FullPost, EntryNode } from "db/wpdb"
import { faRss } from "@fortawesome/free-solid-svg-icons/faRss"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons/faExternalLinkAlt"
import { faAngleDoubleDown } from "@fortawesome/free-solid-svg-icons/faAngleDoubleDown"
import { faTwitter } from "@fortawesome/free-brands-svg-icons/faTwitter"
import { faFacebookSquare } from "@fortawesome/free-brands-svg-icons/faFacebookSquare"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"
import { splitOnLastWord } from "utils/server/serverUtil"
import { NewsletterSubscriptionForm } from "site/client/NewsletterSubscription"

export const FrontPage = (props: {
    entries: CategoryWithEntries[]
    posts: FullPost[]
    totalCharts: number
}) => {
    const { entries, posts, totalCharts } = props

    // Structured data for google
    const structuredMarkup = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        url: settings.BAKED_BASE_URL,
        potentialAction: {
            "@type": "SearchAction",
            target: `${settings.BAKED_BASE_URL}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string"
        }
    }

    const renderEntry = (entry: EntryNode, categorySlug: string) => {
        const { start: titleStart, end: titleEnd } = splitOnLastWord(
            entry.title
        )
        return (
            <a
                key={entry.slug}
                href={`/${entry.slug}`}
                className={`entry-item-container ${categorySlug}-color`}
                data-track-note="homepage-entries"
            >
                <div className="entry-item">
                    <div className="top">
                        {entry.kpi && (
                            <div
                                className="kpi"
                                dangerouslySetInnerHTML={{
                                    __html: entry.kpi
                                }}
                            />
                        )}
                        <p className="excerpt">{entry.excerpt}</p>
                    </div>
                    <div className="bottom">
                        <h5>
                            {titleStart}
                            <span>
                                {titleEnd}
                                <FontAwesomeIcon icon={faArrowRight} />
                            </span>
                        </h5>
                    </div>
                </div>
            </a>
        )
    }

    return (
        <html>
            <Head canonicalUrl={settings.BAKED_BASE_URL}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(structuredMarkup)
                    }}
                />
            </Head>
            <body className="FrontPage">
                <SiteHeader />

                <section className="homepage-masthead">
                    <div className="wrapper">
                        <h1>
                            Research and data to make progress against the
                            world’s largest problems
                        </h1>
                        <a
                            href="#entries"
                            className="see-all"
                            data-smooth-scroll
                            data-track-note="homepage-scroll"
                        >
                            Scroll to all our articles
                            <span className="icon">
                                <FontAwesomeIcon icon={faAngleDoubleDown} />
                            </span>
                        </a>
                        <p>{totalCharts} charts across 297 topics</p>
                        <p>All free: open access and open source</p>
                    </div>
                </section>

                <section className="homepage-coverage">
                    <div className="wrapper">
                        <div className="inner-wrapper">
                            <div className="owid-row owid-spacing--4">
                                <div className="owid-col owid-col--lg-2 owid-padding-bottom--sm-5">
                                    <section>
                                        <h3 className="align-center">
                                            Trusted in{" "}
                                            <strong>research and media</strong>
                                        </h3>
                                        <a
                                            href="/about/coverage#coverage"
                                            className="coverage-link"
                                            data-track-note="homepage-trust"
                                        >
                                            <img
                                                src={`${settings.BAKED_BASE_URL}/media-logos-wide.png`}
                                                alt="Logos of the publications that have used our content"
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
                                            data-track-note="homepage-trust"
                                        >
                                            <img
                                                src={`${settings.BAKED_BASE_URL}/university-logos-wide.png`}
                                                alt="Logos of the universities that have used our content"
                                            />
                                            <div className="hover-note">
                                                <p>
                                                    Find out how our work is
                                                    used in teaching
                                                </p>
                                            </div>
                                        </a>
                                    </section>
                                </div>
                                {/* <div className="owid-col owid-col--lg-shrink md-up flex-row">
                                    <div className="divider"></div>
                                </div> */}
                                <div className="owid-col owid-col--lg-1">
                                    <section>
                                        <h3>
                                            <strong>Authored by</strong>
                                        </h3>
                                        <ul>
                                            <li>
                                                <strong>Max Roser</strong>{" "}
                                                &ndash; Founder and editor
                                            </li>
                                            <li>
                                                <strong>
                                                    Esteban Ortiz-Ospina
                                                </strong>{" "}
                                                &ndash; Social science
                                            </li>
                                            <li>
                                                <strong>Hannah Ritchie</strong>{" "}
                                                &ndash; Environmental science
                                            </li>
                                            <li>
                                                <strong>Joe Hasell</strong>{" "}
                                                &ndash; Social science
                                            </li>
                                            <li>
                                                <strong>Daniel Gavrilov</strong>{" "}
                                                &ndash; Web developer
                                            </li>
                                            <li>
                                                <strong>Matthieu Bergel</strong>{" "}
                                                &ndash; Web engineer
                                            </li>
                                        </ul>
                                    </section>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* <section className="homepage-featured">
                <div className="wrapper">
                    <div className="inner-wrapper">
                        <h2>Our most popular research</h2>
                        <div className="owid-row owid-spacing--1">
                            <div className="owid-col owid-col--lg-auto">
                                <div className="list">
                                    <a href="/co2-and-other-greenhouse-gas-emissions" className="list-item" data-track-note="homepage-popular">
                                        <div className="icon">
                                            <FontAwesomeIcon icon={faBook} />
                                        </div>
                                        <div className="label">
                                            CO₂ and other Greenhouse Gas Emissions
                                        </div>
                                    </a>
                                    <a href="/a-history-of-global-living-conditions-in-5-charts" className="list-item" data-track-note="homepage-popular">
                                        <div className="icon">
                                            <FontAwesomeIcon icon={faFileAlt} />
                                        </div>
                                        <div className="label">
                                            The short history of global living conditions
                                        </div>
                                    </a>
                                    <a href="/literacy" className="list-item" data-track-note="homepage-popular">
                                        <div className="icon">
                                            <FontAwesomeIcon icon={faBook} />
                                        </div>
                                        <div className="label">
                                            Literacy
                                        </div>
                                    </a>
                                    <a href="/world-population-growth" className="list-item" data-track-note="homepage-popular">
                                        <div className="icon">
                                            <FontAwesomeIcon icon={faBook} />
                                        </div>
                                        <div className="label">
                                            World Population Growth
                                        </div>
                                    </a>
                                    <a href="/life-expectancy" className="list-item" data-track-note="homepage-popular">
                                        <div className="icon">
                                            <FontAwesomeIcon icon={faBook} />
                                        </div>
                                        <div className="label">
                                            Life expectancy
                                        </div>
                                    </a>
                                    <a href="/why-do-women-live-longer-than-men" className="list-item" data-track-note="homepage-popular">
                                        <div className="icon">
                                            <FontAwesomeIcon icon={faFileAlt} />
                                        </div>
                                        <div className="label">
                                            Why do women live longer?
                                        </div>
                                    </a>
                                </div>
                            </div>
                            <div className="owid-col owid-col--lg-auto">
                                <div className="list">
                                    <a href="/hunger-and-undernourishment" className="list-item" data-track-note="homepage-popular">
                                        <div className="icon">
                                            <FontAwesomeIcon icon={faBook} />
                                        </div>
                                        <div className="label">
                                            Hunger and undernourishment
                                        </div>
                                    </a>
                                    <a href="/income-inequality" className="list-item" data-track-note="homepage-popular">
                                        <div className="icon">
                                            <FontAwesomeIcon icon={faBook} />
                                        </div>
                                        <div className="label">
                                            Income inequality
                                        </div>
                                    </a>
                                    <a href="/faq-on-plastics" className="list-item" data-track-note="homepage-popular">
                                        <div className="icon">
                                            <FontAwesomeIcon icon={faFileAlt} />
                                        </div>
                                        <div className="label">
                                            FAQs on plastics pollution
                                        </div>
                                    </a>
                                    <a href="/global-rise-of-education" className="list-item" data-track-note="homepage-popular">
                                        <div className="icon">
                                            <FontAwesomeIcon icon={faBook} />
                                        </div>
                                        <div className="label">
                                            Global rise of education
                                        </div>
                                    </a>
                                    <a href="/much-better-awful-can-be-better" className="list-item" data-track-note="homepage-popular">
                                        <div className="icon">
                                            <FontAwesomeIcon icon={faFileAlt} />
                                        </div>
                                        <div className="label">
                                            The world is much better; The world is awful; The world can be much better
                                        </div>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section> */}

                <section className="homepage-posts">
                    <div className="wrapper">
                        <div className="owid-row">
                            <div className="owid-col flex-row">
                                <div className="homepage-posts--explainers">
                                    <div className="header">
                                        <h2>Latest publications</h2>
                                    </div>
                                    <ul>
                                        {posts.slice(0, 8).map(post => (
                                            <li key={post.slug}>
                                                <a
                                                    href={`/${post.path}`}
                                                    data-track-note="homepage-explainer"
                                                >
                                                    <div className="thumbnail">
                                                        <div
                                                            className="cover-image"
                                                            style={{
                                                                backgroundImage:
                                                                    post.imageUrl &&
                                                                    `url(${post.imageUrl})`
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="info">
                                                        <h3 className="title">
                                                            {post.title}
                                                        </h3>
                                                    </div>
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="see-all">
                                        <a
                                            href="/blog"
                                            data-track-note="homepage-see-all-explainers"
                                        >
                                            <div className="label">
                                                See all posts
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

                <section className="homepage-subscribe">
                    <div className="wrapper">
                        <div className="owid-row">
                            <div className="owid-col owid-col--lg-2 flex-row owid-padding-bottom--sm-3">
                                <div className="newsletter-subscription">
                                    <div className="box">
                                        <h2>Subscribe to our newsletter</h2>
                                        <div className="root">
                                            {/* Hydrated in runSiteTools() */}
                                            <NewsletterSubscriptionForm context="homepage" />
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
                                                data-track-note="homepage-follow-us"
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
                                                data-track-note="homepage-follow-us"
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
                                                href="/feed"
                                                className="list-item"
                                                title="RSS"
                                                target="_blank"
                                                data-track-note="homepage-follow-us"
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

                <section className="homepage-projects">
                    <div className="wrapper">
                        <div className="list">
                            <a
                                href="https://sdg-tracker.org"
                                className="list-item"
                                data-track-note="homepage-projects"
                            >
                                <div className="icon-left">
                                    <img
                                        src={`${settings.BAKED_BASE_URL}/sdg-wheel.png`}
                                        alt="SDG Tracker logo"
                                    />
                                </div>
                                <div className="content">
                                    <h3>
                                        Sustainable Development Goals Tracker
                                    </h3>
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
                                data-track-note="homepage-projects"
                            >
                                <div className="icon-left">
                                    <img
                                        src={`${settings.BAKED_BASE_URL}/teaching-hub.svg`}
                                        alt="Teaching Hub logo"
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

                <section id="entries" className="homepage-entries">
                    <div className="wrapper">
                        <h2>
                            All our articles on global problems and global
                            changes
                        </h2>
                        {entries.map(category => (
                            <div
                                key={category.slug}
                                className="category-wrapper"
                            >
                                <h3
                                    className={`${category.slug}-color`}
                                    id={category.slug}
                                >
                                    {category.name}
                                </h3>
                                {!!category.entries.length && (
                                    <div className="category-entries">
                                        {category.entries.map(entry =>
                                            renderEntry(entry, category.slug)
                                        )}
                                    </div>
                                )}
                                {category.subcategories.map(subcategory => (
                                    <div key={subcategory.slug}>
                                        <h4
                                            className={`${category.slug}-color`}
                                        >
                                            {subcategory.name}
                                        </h4>
                                        <div className="category-entries">
                                            {subcategory.entries.map(entry =>
                                                renderEntry(
                                                    entry,
                                                    category.slug
                                                )
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>

                <SiteFooter />
            </body>
        </html>
    )
}
