import * as settings from 'settings'
import * as React from 'react'
import { Head } from './Head'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { CategoryWithEntries } from 'db/wpdb'
import { formatDate } from '../formatting'
import { faRss, faSearch } from '@fortawesome/free-solid-svg-icons'
import { faTwitter, faFacebookF } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const FrontPage = (props: { entries: CategoryWithEntries[], posts: { title: string, slug: string, date: Date }[] }) => {
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
                            <p>Search across <em>70,000</em> variables, <em>2700</em> charts, and <em>100</em> entries</p>
                            <input type="search" placeholder='Try "poverty" or "population growth"' />
                            <div className="icon">
                                <FontAwesomeIcon icon={faSearch} />
                            </div>
                        </div>
                    </div>
                </div>
            </SiteHeader>
            <main>
                <div id="homepage-content" className="clearfix">
                    <div id="homepage-latest">
                        <h3><a href="/grapher/latest">Latest Visualization</a></h3>
                        <figure data-grapher-src="https://ourworldindata.org/grapher/latest" style={{ height: "660px" }}/>
                    </div>
                    <div id="homepage-blog">
                        <h3><a href="/blog">Blog</a></h3>
                        <ul>
                            {posts.map(post => <li key={post.slug} className="post">
                                <h4><a href={`/${post.slug}`}>{post.title}</a></h4>
                                <div className="entry-meta">
                                    <time>{formatDate(post.date)}</time>
                                </div>
                            </li>)}
                        </ul>
                        <a className="more" href="/blog">More →</a>
                    </div>
                    <div id="homepage-entries" className="owid-data">
                        <h3 id="entries"><a href="#entries">Entries</a></h3>
                        <p>Ongoing collections of research and data by topic. Entries marked with <span className="star">⭑</span> are the most complete.</p>
                        <ul>
                            {entries.map(category => <li key={category.slug}>
                                <h4 id={category.slug}>{category.name}</h4>
                                <div className="link-container">
                                    {category.entries.map(entry =>
                                        <a key={entry.slug} className={entry.starred ? "starred" : undefined} title={entry.starred ? "Starred pages are our best and most complete entries." : undefined} href={`/${entry.slug}`}>{entry.title}</a>
                                    )}
                                </div>
                            </li>)}
                        </ul>
                    </div>
                    <div className="owid-data owid-presentations">
                        <h3 id="presentations"><a href="#presentations">Presentations</a></h3>
                        <p>Visual histories spanning multiple topics.</p>
                        <ul>
                            <li><h4>Visual History of...</h4><div className='link-container'><a href='/slides/war-and-violence'>War & Violence</a><a href='/slides/world-poverty'>World Poverty</a><a href='/slides/global-health'>Global Health</a><a href='/slides/hunger-and-food-provision'>World Hunger & Food Provision</a><a href='/slides/africa-in-data'>Africa</a></div></li>
                        </ul>
                    </div>
                    <div id="homepage-twitter">
                        <h3><a href="https://twitter.com/OurWorldInData">Follow us</a></h3>
                        <div className="social">
                            <a href="https://twitter.com/OurWorldInData"><FontAwesomeIcon icon={faTwitter}/></a>
                            <a href="https://www.facebook.com/OurWorldinData"><FontAwesomeIcon icon={faFacebookF}/></a>
                            <a href="/feed/"><FontAwesomeIcon icon={faRss}/></a>
                        </div>
                    </div>
                </div>
            </main>
            <SiteFooter />
        </body>
    </html>
}
