import * as settings from '../settings'
import * as React from 'react'
import { Head } from './Head'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { CategoryWithEntries } from '../wpdb'
import { formatDate } from '../formatting'
import { faRss } from '@fortawesome/free-solid-svg-icons'
import { faTwitter, faFacebookF } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const FrontPage = (props: { entries: CategoryWithEntries[], posts: { title: string, slug: string, date: Date }[] }) => {
    const { entries, posts } = props

    // Structured data for google
    const structuredMarkup = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "url": settings.BAKED_URL,
        "potentialAction": {
            "@type": "SearchAction",
            "target": `${settings.BAKED_URL}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string"
        }
    }

    return <html>
        <Head canonicalUrl={settings.BAKED_URL}>
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(structuredMarkup)}}/>
        </Head>
        <body className="FrontPage">
            <SiteHeader/>
            <main>
                <div id="homepage-cover">
                    <div className="lead-in">
                        <h1 className="desktop">Our world is changing</h1>
                        <div className="desktop subheading">Explore the ongoing history of human civilization at the broadest level, through research and data visualization.</div>
                        <div className="mobile subheading">Living conditions around the world are changing rapidly. Explore how and why.</div>
                        <img className="down-arrow" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAM1BMVEUAAAD/zB//zB//zB//zB//zB//zB//zB//zB//zB//zB//zB//zB//zB//zB//zB//zB8l5oYuAAAAEHRSTlMAECAwQFBgcICPn6+/z9/vIxqCigAAAVxJREFUOMuFlcsWwyAIRFF8izr//7VdNK2KTeomJ+YGZggSon3ZkLJISZHpYdnc8V2juBvMCYCanCNiF8sAeviBmQz0YJYdL4BYzXGf7zPPHEMF9QPlG03kux+BtMkD4rxbQHJjJXlgzbCC2zPT13gKJAY+mjMq3YMU0a4yY5gnkORKXqBKoEGLvlwewCtU3J38AhmViBrsP5A6DJmPpycww5ND/g96JIoI/0GLSglbfxb7Bm3ZSIgGM5IRMUkJOkEGeu8dqhQnSO19YlQpIIeZ8AbDYUaXxwwAuk080lnwAgDlLDg1GPVhMVv1K9wQZd0U7bDCaL/arByZr46tp2/teVyBd4+sJcpHXFapxlAZ2jyu4eG4jplADYCU6G447Pq937iinM4hZcw6pFSpeKAfE5YFZ/+bCsi26wrQ+GY0jxqdJTIulH4zmomIuIw57FH904+BY6oikpIW/AINdBKzcQVAtQAAAABJRU5ErkJggg==" />
                        <div className="title-author-byline">A web publication by <a href="https://www.MaxRoser.com/about" target="_blank" rel="noopener">Max Roser</a>.</div>
                    </div>
                </div>
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