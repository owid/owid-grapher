import * as settings from 'settings'
import * as React from 'react'
import { Head } from './Head'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { CategoryWithEntries, PostInfo } from 'db/wpdb'
import { formatDate } from '../formatting'
import { faRss, faSearch, faBook, faAngleRight, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons'
import { faFileAlt } from '@fortawesome/free-regular-svg-icons'
import { faTwitter, faFacebook } from '@fortawesome/free-brands-svg-icons'
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
            <SiteHeader/>

            <section className="homepage-masthead">
                <div className="wrapper">
                    <div className="homepage-masthead--main">
                        <h1 className="desktop-only">Know the world you live in</h1>
                        <div className="subheading">Understand how the world is changing through research and interactive data visualizations.</div>
                        {/* <div className="title-author-byline">A web publication by <a href="https://www.MaxRoser.com/about" target="_blank" rel="noopener">Max Roser</a>.</div> */}
                    </div>
                    <div className="homepage-masthead--search">
                        <form action="/search" method="get">
                            <h2>Search across <em>2700 charts</em>, <em>100 entries</em> and <em>127 blog posts</em></h2>
                            <div className="search-input-wrapper">
                                <div className="icon"><FontAwesomeIcon icon={faSearch} /></div>
                                <input type="search" placeholder="Try &quot;poverty&quot; or &quot;population growth&quot;" name="q" />
                            </div>
                        </form>
                        {/* <div className="columns counts">
                            <div className="column">
                                <div className="number">2700</div>
                                <div className="label">charts</div>
                            </div>
                            <div className="column">
                                <div className="number">100</div>
                                <div className="label">entries</div>
                            </div>
                            <div className="column">
                                <div className="number">127</div>
                                <div className="label">posts</div>
                            </div>
                        </div> */}
                    </div>
                </div>
            </section>

            <section className="homepage-featured">
                <div className="wrapper">
                    <div className="shaded-box">
                        <h2>Our most important research</h2>
                        <div className="list">
                            <a href="#" className="list-item">
                                <div className="icon">
                                    <FontAwesomeIcon icon={faFileAlt} />
                                </div>
                                <div className="label">
                                    The short history of global living conditions
                                </div>
                            </a>
                            <a href="#" className="list-item">
                                <div className="icon">
                                    <FontAwesomeIcon icon={faBook} />
                                </div>
                                <div className="label">
                                    Extreme Poverty
                                </div>
                            </a>
                            <a href="#" className="list-item">
                                <div className="icon">
                                    <FontAwesomeIcon icon={faBook} />
                                </div>
                                <div className="label">
                                    World Population Growth
                                </div>
                            </a>
                            <a href="#" className="list-item">
                                <div className="icon">
                                    <FontAwesomeIcon icon={faBook} />
                                </div>
                                <div className="label">
                                    CO₂ and other Greenhouse Gas Emissions
                                </div>
                            </a>
                            <a href="#" className="list-item">
                                <div className="icon">
                                    <FontAwesomeIcon icon={faBook} />
                                </div>
                                <div className="label">
                                    Life expectancy
                                </div>
                            </a>
                            <a href="#" className="list-item">
                                <div className="icon">
                                    <FontAwesomeIcon icon={faFileAlt} />
                                </div>
                                <div className="label">
                                    Why do women live longer?
                                </div>
                            </a>
                            <a href="#" className="list-item">
                                <div className="icon">
                                    <FontAwesomeIcon icon={faBook} />
                                </div>
                                <div className="label">
                                    Hunger and malnourishment
                                </div>
                            </a>
                            <a href="#" className="list-item">
                                <div className="icon">
                                    <FontAwesomeIcon icon={faBook} />
                                </div>
                                <div className="label">
                                    Income inequality
                                </div>
                            </a>
                            <a href="#" className="list-item">
                                <div className="icon">
                                    <FontAwesomeIcon icon={faFileAlt} />
                                </div>
                                <div className="label">
                                    FAQs on plastics pollution
                                </div>
                            </a>
                            <a href="#" className="list-item">
                                <div className="icon">
                                    <FontAwesomeIcon icon={faBook} />
                                </div>
                                <div className="label">
                                    Global rise of education
                                </div>
                            </a>
                            <a href="#" className="list-item">
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
            </section>

            <section className="homepage-coverage">
                <div className="wrapper">
                    <div className="owid-row flex-align-center">
                        <div className="owid-column--1">
                            <p className="lead">Read by more than <strong>10 million people per year</strong>, from every country in the world.</p>
                        </div>
                        <div className="owid-column--1">
                            <img src="/coverage-logos.png" alt="" />
                        </div>
                    </div>
                </div>
            </section>

            <section className="homepage-posts">
                <div className="wrapper">
                    <div className="owid-row">
                        <div className="owid-column--1">
                            <div className="homepage-posts--updates">
                                <div className="header">
                                    <h2>Short updates and facts</h2>
                                </div>
                                <div className="list">
                                    {posts.slice(1,6).map(post => <a key={post.slug} href={`/${post.slug}`} className="list-item">
                                        <div className="thumbnail">
                                            <img src={post.imageUrl} />
                                        </div>
                                        <div className="info">
                                            <time className="date">{formatDate(post.date)}</time>
                                            <h3 className="title">{post.title}</h3>
                                        </div>
                                    </a>)}
                                </div>
                                <a href="/blog" className="see-all">
                                    <div className="label">See all short updates and facts</div>
                                    <div className="icon"><FontAwesomeIcon icon={faAngleRight} /></div>
                                </a>
                            </div>
                        </div>
                        <div className="owid-column--2">
                            <div className="homepage-posts--explainers">
                                <div className="header">
                                    <h2>Explainers</h2>
                                </div>
                                <div className="list">
                                    {posts.slice(6,12).map(post => <div key={post.slug} className="list-item-wrapper">
                                        <a href={`/${post.slug}`} className="list-item">
                                            <div className="thumbnail">
                                                <img src={post.imageUrl} />
                                            </div>
                                            <div className="info">
                                                <h3 className="title">{post.title}</h3>
                                            </div>
                                        </a>
                                    </div>)}
                                </div>
                                <a href="/blog" className="see-all">
                                    <div className="label">See all explainers</div>
                                    <div className="icon"><FontAwesomeIcon icon={faAngleRight} /></div>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="homepage-subscribe">
                <div className="wrapper">
                    <div className="owid-row flex-stretch">
                        <div className="owid-column--2">
                            <div className="homepage-subscribe--newsletter">
                                <div className="shaded-box">
                                    <h2>Subscribe to our newsletter</h2>
                                    <form>
                                        <fieldset>
                                            <div className="owid-checkboxes">
                                                <div className="owid-checkbox-block">
                                                    <input type="checkbox" id="weekly" value="weekly" name="type" defaultChecked />
                                                    <label htmlFor="weekly">
                                                        <div className="label-title">Weekly digest</div>
                                                        <div className="label-text">Get weekly emails with the biggest news.</div>
                                                    </label>
                                                </div>
                                                <div className="owid-checkbox-block">
                                                    <input type="checkbox" id="immediate" value="immediate" name="type" />
                                                    <label htmlFor="immediate">
                                                        <div className="label-title">Immediate updates</div>
                                                        <div className="label-text">Get emails whenever we produce new content.</div>
                                                    </label>
                                                </div>
                                            </div>
                                        </fieldset>
                                        <div className="owid-inline-field">
                                            <input placeholder="Your email address" type="email" className="owid-inline-input" />
                                            <button type="submit" className="owid-inline-button">Subscribe</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                        <div className="owid-column--1">
                            <div className="homepage-subscribe--social-media">
                                <div className="shaded-box">
                                    <h2>Follow us</h2>
                                    <div className="list">
                                        <a href="#" className="list-item">
                                            <div className="icon">
                                                <FontAwesomeIcon icon={faTwitter} />
                                            </div>
                                            <div className="label">Twitter</div>
                                        </a>
                                        <a href="#" className="list-item">
                                            <div className="icon">
                                                <FontAwesomeIcon icon={faFacebook} />
                                            </div>
                                            <div className="label">Facebook</div>
                                        </a>
                                        <a href="#" className="list-item">
                                            <div className="icon">
                                                <FontAwesomeIcon icon={faRss} />
                                            </div>
                                            <div className="label">RSS Feed</div>
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
                    <h2>Our other projects</h2>
                    <div className="list">
                        <a href="#" className="list-item">
                            <div className="icon-left">
                                <img src="" alt=""/>
                            </div>
                            <div className="content">
                                <h3>Sustainable Development Goals Tracker</h3>
                                <p>Is the world on track to reach the Sustainable Development Goals?</p>
                            </div>
                            <div className="icon-right">
                                <FontAwesomeIcon icon={faExternalLinkAlt} />
                            </div>
                        </a>
                        <a href="#" className="list-item">
                            <div className="icon-left">
                                <img src="" alt=""/>
                            </div>
                            <div className="content">
                                <h3>Teaching Hub</h3>
                                <p>Slides, research, and visualizations for teaching and learning about global development</p>
                            </div>
                            <div className="icon-right">
                                <FontAwesomeIcon icon={faExternalLinkAlt} />
                            </div>
                        </a>
                    </div>
                </div>
            </section>

            <section className="homepage-about"></section>

            <section className="homepage-entries">
                <div className="wrapper">
                    <h2>All topics</h2>
                    {entries.map(category => <div key={category.slug} className="category-wrapper">
                        <div className="category-name">
                            <h3>{category.name}</h3>
                        </div>
                        <div className="category-entries">
                            {category.entries.map(entry => <a key={entry.slug} href={`/${entry.slug}`} className="entry-wrapper">
                                <h4>{entry.title}</h4>
                            </a>)}
                        </div>
                    </div>)}
                </div>
            </section>

            <SiteFooter />
        </body>
    </html>
}
