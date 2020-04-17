import { BAKED_BASE_URL, WORDPRESS_URL } from "settings"
import * as React from "react"
import { Head } from "./Head"
import { CitationMeta } from "./CitationMeta"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import {
    formatAuthors,
    formatDate,
    FormattedPost,
    FormattingOptions
} from "../formatting"
import { CategoryWithEntries } from "db/wpdb"
import { SiteSubnavigation } from "./SiteSubnavigation"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBook } from "@fortawesome/free-solid-svg-icons/faBook"
import { faCreativeCommons } from "@fortawesome/free-brands-svg-icons/faCreativeCommons"
import { TableOfContents } from "site/client/TableOfContents"

export const LongFormPage = (props: {
    entries: CategoryWithEntries[]
    post: FormattedPost
    formattingOptions: FormattingOptions
}) => {
    const { entries, post, formattingOptions } = props

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
    const isPost = post.type === "post"
    const authorsText = formatAuthors(post.authors, isEntry)

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
        post.tocHeadings.push({
            text: "Licence",
            slug: "licence",
            isSubheading: false
        })
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
                        className={`page${
                            hasSidebar ? " with-sidebar" : " no-sidebar"
                        }${isPost ? " thin-banner" : " large-banner"}`}
                    >
                        <div className="offset-header">
                            <header className="article-header">
                                <h1 className="entry-title">{post.title}</h1>
                                {!formattingOptions.hideAuthors && (
                                    <div className="authors-byline">
                                        <a href="/team">by {authorsText}</a>
                                    </div>
                                )}
                                {isPost && <time>{formatDate(post.date)}</time>}
                                {post.info && (
                                    <div
                                        className="blog-info"
                                        dangerouslySetInnerHTML={{
                                            __html: post.info
                                        }}
                                    />
                                )}

                                {post.lastUpdated && (
                                    <div
                                        className="last-updated"
                                        dangerouslySetInnerHTML={{
                                            __html: post.lastUpdated
                                        }}
                                    />
                                )}
                                {(isPost || isEntry) && (
                                    <div className="tools">
                                        {(isPost || isEntry) && (
                                            <a href="#licence">
                                                <FontAwesomeIcon
                                                    icon={faCreativeCommons}
                                                />
                                                Reuse our work{" "}
                                                <strong>freely</strong>
                                            </a>
                                        )}
                                        {isEntry && (
                                            <a href="#citation">
                                                <FontAwesomeIcon
                                                    icon={faBook}
                                                />
                                                Cite this research
                                            </a>
                                        )}
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
                                        <div className="wp-block-columns">
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
                                                {(isPost || isEntry) && (
                                                    <>
                                                        <h3 id="licence">
                                                            Licence
                                                        </h3>
                                                        <p>
                                                            You can use all of
                                                            what you find here
                                                            for your own
                                                            research or writing.
                                                            We{" "}
                                                            <a href="/how-to-use-our-world-in-data#how-is-our-work-copyrighted">
                                                                license all
                                                                charts under{" "}
                                                                <em>
                                                                    Creative
                                                                    Commons BY
                                                                </em>
                                                                .
                                                            </a>
                                                        </p>
                                                        <p>
                                                            All of{" "}
                                                            <a href="/how-to-use-our-world-in-data#how-to-embed-interactive-charts-in-your-article">
                                                                our charts can
                                                                be embedded
                                                            </a>{" "}
                                                            in any site.
                                                        </p>
                                                    </>
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
                                    href={`${WORDPRESS_URL}/wp/wp-admin`}
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
                        runRelatedCharts(${JSON.stringify(post.relatedCharts)})
                        `
                    }}
                />
            </body>
        </html>
    )
}
