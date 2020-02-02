import { faBook } from "@fortawesome/free-solid-svg-icons/faBook"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { CategoryWithEntries } from "db/wpdb"
import * as React from "react"
import { BAKED_BASE_URL, WORDPRESS_URL } from "settings"
import { TableOfContents } from "site/client/TableOfContents"

import { formatAuthors, FormattedPost, FormattingOptions } from "../formatting"

import { CitationMeta } from "./CitationMeta"
import { Head } from "./Head"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"
import { SiteSubnavigation } from "./SiteSubnavigation"

export const LongFormPage = (props: {
    entries: CategoryWithEntries[]
    post: FormattedPost
    formattingOptions: FormattingOptions
}) => {
    const { entries, post, formattingOptions } = props
    const authorsText = formatAuthors(post.authors, true)

    const pageTitle = post.title
    const canonicalUrl = `${BAKED_BASE_URL}/${post.slug}`
    const pageDesc = post.excerpt
    const publishedYear = post.modifiedDate.getFullYear()

    const isEntry = entries.some(category => {
        return (
            category.entries.some(entry => entry.slug === post.slug) ||
            category.subcategories.some((subcategory: CategoryWithEntries) => {
                return subcategory.entries.some(
                    subEntry => subEntry.slug === post.slug
                )
            })
        )
    })

    const bodyClasses = []
    let hasSidebar = false
    if (post.tocHeadings.length > 0) {
        hasSidebar = true
        if (post.footnotes.length) {
            post.tocHeadings.push({
                text: "References",
                slug: "references",
                isSubheading: false
            })
        }
        if (isEntry) {
            post.tocHeadings.push({
                text: "Citation",
                slug: "citation",
                isSubheading: false
            })
        }
    }
    if (formattingOptions.bodyClassName) {
        bodyClasses.push(formattingOptions.bodyClassName)
    }

    const bibtex = `@article{owid${post.slug.replace(/-/g, "")},
    author = {${authorsText}},
    title = {${pageTitle}},
    journal = {Our World in Data},
    year = {${publishedYear}},
    note = {${canonicalUrl}}
}`

    return (
        <html>
            <Head
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                canonicalUrl={canonicalUrl}
                imageUrl={post.imageUrl}
            >
                {isEntry && (
                    <CitationMeta
                        id={post.id}
                        title={pageTitle}
                        authors={post.authors}
                        date={post.date}
                        canonicalUrl={canonicalUrl}
                    />
                )}
            </Head>
            <body className={bodyClasses.join(" ")}>
                <SiteHeader />
                {formattingOptions.subnavId && (
                    <SiteSubnavigation
                        subnavId={formattingOptions.subnavId}
                        subnavCurrentId={formattingOptions.subnavCurrentId}
                    />
                )}
                <main>
                    <article
                        className={`page ${
                            hasSidebar ? "with-sidebar" : "no-sidebar"
                        }`}
                    >
                        <div className="offset-header">
                            <header className="article-header">
                                <h1 className="entry-title">{post.title}</h1>
                                {!formattingOptions.hideAuthors && (
                                    <div className="authors-byline">
                                        <a href="/team">by {authorsText}</a>
                                    </div>
                                )}
                                {post.info && (
                                    <div className="wp-block-columns">
                                        <div className="wp-block-column">
                                            <div
                                                className="blog-info"
                                                dangerouslySetInnerHTML={{
                                                    __html: post.info
                                                }}
                                            />
                                        </div>
                                        <div className="wp-block-column"></div>
                                    </div>
                                )}
                                {isEntry && (
                                    <div className="tools">
                                        <a href="#citation" className="cite">
                                            <FontAwesomeIcon icon={faBook} />
                                            Cite this research
                                        </a>
                                    </div>
                                )}
                            </header>
                        </div>

                        <div className="content-wrapper">
                            {post.tocHeadings.length > 0 && (
                                <div>
                                    <TableOfContents
                                        headings={post.tocHeadings}
                                        pageTitle={pageTitle}
                                    />
                                </div>
                            )}
                            <div className="offset-content">
                                <div className="content-and-footnotes">
                                    <div
                                        className="article-content"
                                        dangerouslySetInnerHTML={{
                                            __html: post.html
                                        }}
                                    />
                                    <footer className="article-footer">
                                        <div className="has-2-columns">
                                            <div className="wp-block-column">
                                                {post.footnotes.length ? (
                                                    <React.Fragment>
                                                        <h3 id="references">
                                                            References
                                                        </h3>
                                                        <ol className="references">
                                                            {post.footnotes.map(
                                                                (
                                                                    footnote,
                                                                    i
                                                                ) => (
                                                                    <li
                                                                        key={i}
                                                                        id={`note-${i +
                                                                            1}`}
                                                                    >
                                                                        <p
                                                                            dangerouslySetInnerHTML={{
                                                                                __html: footnote
                                                                            }}
                                                                        />
                                                                    </li>
                                                                )
                                                            )}
                                                        </ol>
                                                    </React.Fragment>
                                                ) : (
                                                    undefined
                                                )}

                                                {isEntry && (
                                                    <React.Fragment>
                                                        <h3 id="citation">
                                                            Citation
                                                        </h3>
                                                        <p>
                                                            Our articles and
                                                            data visualizations
                                                            rely on work from
                                                            many different
                                                            people and
                                                            organizations. When
                                                            citing this entry,
                                                            please also cite the
                                                            underlying data
                                                            sources. This entry
                                                            can be cited as:
                                                        </p>
                                                        <pre className="citation">
                                                            {authorsText} (
                                                            {publishedYear}) - "
                                                            {pageTitle}".{" "}
                                                            <em>
                                                                Published online
                                                                at
                                                                OurWorldInData.org.
                                                            </em>{" "}
                                                            Retrieved from: '
                                                            {canonicalUrl}'
                                                            [Online Resource]
                                                        </pre>
                                                        <p>BibTeX citation</p>
                                                        <pre className="citation">
                                                            {bibtex}
                                                        </pre>
                                                    </React.Fragment>
                                                )}
                                            </div>
                                            <div className="wp-block-column"></div>
                                        </div>
                                    </footer>
                                </div>
                            </div>
                        </div>
                    </article>
                </main>
                <div id="wpadminbar" style={{ display: "none" }}>
                    <div
                        className="quicklinks"
                        id="wp-toolbar"
                        role="navigation"
                        aria-label="Toolbar"
                    >
                        <ul
                            id="wp-admin-bar-root-default"
                            className="ab-top-menu"
                        >
                            <li id="wp-admin-bar-site-name" className="menupop">
                                <a
                                    className="ab-item"
                                    aria-haspopup="true"
                                    href="/wp/wp-admin/"
                                >
                                    Wordpress
                                </a>
                            </li>{" "}
                            <li id="wp-admin-bar-edit">
                                <a
                                    className="ab-item"
                                    href={`${WORDPRESS_URL}/wp/wp-admin/post.php?post=${post.postId ||
                                        post.id}&action=edit`}
                                >
                                    Edit Page
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                <SiteFooter hideDonate={formattingOptions.hideDonateFooter} />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                        runTableOfContents(${JSON.stringify({
                            headings: post.tocHeadings,
                            pageTitle
                        })})
                        `
                    }}
                />
            </body>
        </html>
    )
}
