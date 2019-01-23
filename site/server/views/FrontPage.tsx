import * as settings from 'settings'
import * as React from 'react'
import { Head } from './Head'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { CategoryWithEntries, PostInfo } from 'db/wpdb'
import { formatDate } from '../formatting'
import { faRss, faSearch } from '@fortawesome/free-solid-svg-icons'
import { faTwitter, faFacebookF } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { BAKED_GRAPHER_URL } from 'settings'

export const FrontPage = (props: { entries: CategoryWithEntries[], posts: PostInfo[] }) => {
    const { entries, posts } = props

    // Structured data for google
    const structuredMarkup = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "url": settings.BAKED_BASE_URL,
        "potentialAction": {
            "@type": "SearchAction",
            "target": `${settings.BAKED_BASE_URL}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string"
        }
    }

    return <html>
        <Head canonicalUrl={settings.BAKED_BASE_URL}>
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(structuredMarkup)}}/>
        </Head>
        <body className="FrontPage">
            <SiteHeader entries={entries}>
                <div className="wrapper">
                    <div className="site-masthead">
                        <h1>Know the world you live in</h1>
                        <p>Understand how the world is changing through research and <em>interactive data visualizations</em>.</p>
                        <div className="masthead-search">
                            <label htmlFor="masthead-search">Search across all content</label>
                            <div className="input-wrapper">
                                <input id="masthead-search" type="search" placeholder='Try "poverty" or "population growth"' />
                                <div className="icon">
                                    <FontAwesomeIcon icon={faSearch} />
                                </div>
                            </div>
                        </div>
                        <p><em>70,000</em> variables, <em>2700</em> charts and <em>100</em> entries.</p>
                        <p>All our content is open access and our tools are open source.</p>
                    </div>
                </div>
            </SiteHeader>

            <section className="recommended-content-section">
                <div className="wrapper">
                    <div className="content">
                    </div>
                </div>
            </section>

            <section className="credibility-section">
                <div className="wrapper">
                    <h2>Cited by</h2>
                    <p>logos</p>
                </div>
            </section>

            <section className="latest-content-section">
                <div className="wrapper">
                    <div className="short-updates-section">
                        <h2>Short updates and posts</h2>
                        <div className="short-updates-list">
                            {posts.slice(0,8).map(post => <div key={post.slug} className="short-updates-item">
                                <div className="thumbnail">
                                    <img src={post.imageUrl} />
                                </div>
                                <div className="metadata">
                                    <h3 className="title">{post.title}</h3>
                                    <time>{formatDate(post.date)}</time>
                                </div>
                            </div>)}
                        </div>
                        <div className="see-all">
                            <a href="/index" className="button">See all short updates and facts</a>
                        </div>
                    </div>
                    <div id="homepage-entries" className="owid-data">
                        <h3 id="entries"><a href="#entries">Entries</a></h3>
                        <ul>
                            {entries.map(category => <li key={category.slug}>
                                <h4 id={category.slug}>{category.name}</h4>
                                <div className="link-container">
                                    {category.entries.map(entry =>
                                        <a key={entry.slug} href={`/${entry.slug}`}>{entry.title}</a>
                                    )}
                                </div>
                            </li>)}
                        </ul>
                        <div className="see-all">
                            <a href="/index" className="button">See all short updates and facts</a>
                        </div>
                    </div>
                </div>
            </section>

            <section className="newsletter-section">
                <div className="wrapper">
                    <h2>Stay up to date</h2>
                    <p>Subscribe to our bi-weekly newsletter to receive &hellip;</p>
                    <div className="newsletter-form">
                        <input type="email" />
                        <button>Subscribe</button>
                    </div>
                </div>
            </section>

            <section className="projects-section">
                <div className="wrapper">
                    <h2>Other projects</h2>
                    <div className="project sdg-tracker">
                        <h3>Sustainable Development Goals Tracker</h3>
                        <p>Is the world on track to reach the Sustainable Development Goals?</p>
                    </div>
                    <div className="project teaching-hub">
                        <h3>Teaching Hub</h3>
                        <p>Slides, research, and visualizations for teaching and learning about global development</p>
                    </div>
                </div>
            </section>

            <section className="about-section"></section>

            <section className="topics-section">
                <div className="wrapper">
                    <h2>Topics</h2>

                    <div className="topics-list">
                        {entries.map(category => <div key={category.slug} className="topics-list-item">
                            <h3>{category.name}</h3>
                            <div className="entries-list">
                                {category.entries.map(entry => <div key={entry.slug} className="entries-list-item">
                                    <h4>{entry.title}</h4>
                                </div>)}
                            </div>
                        </div>)}
                    </div>
                </div>
            </section>

            <SiteFooter />
        </body>
    </html>
}
