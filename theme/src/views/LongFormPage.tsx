import {BAKED_URL, WORDPRESS_URL} from '../settings'
import * as React from 'react'
import { Head } from './Head'
import { CitationMeta } from './CitationMeta'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { formatAuthors, FormattedPost, FormattingOptions } from '../formatting'
import { CategoryWithEntries } from '../wpdb'
import * as _ from 'lodash'

export const LongFormPage = (props: { entries: CategoryWithEntries[], post: FormattedPost, formattingOptions: FormattingOptions }) => {
    const {entries, post, formattingOptions} = props
    const authorsText = formatAuthors(post.authors, true)

    const pageTitle = post.title
    const canonicalUrl = `${BAKED_URL}/${post.slug}`
    const pageDesc = post.excerpt
    const publishedYear = post.modifiedDate.getFullYear()
    const allEntries = _.flatten(_.values(entries).map(c => c.entries))
    const isEntry = _.includes(allEntries.map(e => e.slug), post.slug)

    const classes = ["LongFormPage"]
    if (formattingOptions.bodyClassName)
        classes.push(formattingOptions.bodyClassName)


    const bibtex = `@article{owid${post.slug.replace(/-/g, '')},
    author = {${authorsText}},
    title = {${pageTitle}},
    journal = {Our World in Data},
    year = {${publishedYear}},
    note = {${canonicalUrl}}
}`

    return <html>
        <Head pageTitle={pageTitle} pageDesc={pageDesc} canonicalUrl={canonicalUrl} imageUrl={post.imageUrl}>
            {isEntry && <CitationMeta title={pageTitle} authors={post.authors} date={post.modifiedDate} canonicalUrl={canonicalUrl}/>}
        </Head>
        <body className={classes.join(" ")}>
            <SiteHeader/>
            <main>
                <article className="page">
                    <header className="articleHeader">
                        <h1 className="entry-title">{post.title}</h1>
                        <div className="authors-byline">
                            <a href="/about/#team">by {authorsText}</a>
                        </div>
                    </header>

                    <div className="contentContainer">
                        {post.tocHeadings.length > 0 && <aside className="entry-sidebar">
                            <nav className="entry-toc">
                                <ul>
                                    <li><a href="#">{pageTitle}</a></li>
                                    {post.tocHeadings.map((heading, i) =>
                                        <li key={i} className={heading.isSubheading ? "subsection" : "section" + ((!post.tocHeadings[i+1] || !post.tocHeadings[i+1].isSubheading) ? " nosubs": "")}>
                                            <a href={`#${heading.slug}`}>{heading.text}</a>
                                        </li>
                                    )}
                                    {post.acknowledgements && <li key="acknowledgements" className="section nosubs">
                                        <a href={`#acknowledgements`}>Acknowledgements</a>
                                    </li>}

                                    {post.footnotes.length ? <li key="footnotes" className="section nosubs">
                                        <a href={`#footnotes`}>Footnotes</a>
                                    </li> : undefined}
                                    {isEntry && <li key="citation" className="section nosubs">
                                        <a href={`#citation`}>Citation</a>
                                    </li>}
                                </ul>
                            </nav>
                        </aside>}

                        <div className="contentAndFootnotes">
                            <div className="article-content" dangerouslySetInnerHTML={{__html: post.html}}/>
                            <footer className="article-footer">
                                {post.acknowledgements && <React.Fragment>
                                    <h3 id="acknowledgements">Acknowledgements</h3>
                                    <section dangerouslySetInnerHTML={{__html: post.acknowledgements}}/>
                                </React.Fragment>}

                                {post.footnotes.length ? <React.Fragment>
                                    <h3 id="footnotes">Footnotes</h3>
                                    <ol className="footnotes">
                                        {post.footnotes.map((footnote, i) =>
                                            <li key={`note-${i+1}`} id={`note-${i+1}`}>
                                                <p dangerouslySetInnerHTML={{__html: footnote}}/>
                                            </li>
                                        )}
                                    </ol>
                                </React.Fragment> : undefined}

                                {isEntry && <React.Fragment>
                                    <h3 id="citation">Citation</h3>
                                    <p>
                                        Our articles and data visualizations rely on work from many different people and organizations. When citing this entry, please also cite the underlying data sources. This entry can be cited as:
                                    </p>
                                    <pre className="citation">
                                        {authorsText} ({publishedYear}) - "{pageTitle}". <em>Published online at OurWorldInData.org.</em> Retrieved from: '{canonicalUrl}' [Online Resource]
                                    </pre>
                                    <p>
                                        BibTeX citation
                                    </p>
                                    <pre className="citation">
                                        {bibtex}
                                    </pre>
                                </React.Fragment>}
                            </footer>
                        </div>
                    </div>
                </article>
            </main>
            <div id="wpadminbar" style={{display: 'none'}}>
                <div className="quicklinks" id="wp-toolbar" role="navigation" aria-label="Toolbar">
                    <ul id="wp-admin-bar-root-default" className="ab-top-menu">
                        <li id="wp-admin-bar-site-name" className="menupop">
                            <a className="ab-item" aria-haspopup="true" href="/wp-admin/">Wordpress</a>
                        </li>{" "}
                        <li id="wp-admin-bar-edit"><a className="ab-item" href={`${WORDPRESS_URL}/wp-admin/post.php?post=${post.id}&action=edit`}>Edit Page</a></li>
                    </ul>
                </div>
            </div>
            <SiteFooter/>
        </body>
    </html>
}
