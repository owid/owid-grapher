import { WORDPRESS_URL } from "../settings/serverSettings"
import * as React from "react"
import { Head } from "./Head"
import { CitationMeta } from "./CitationMeta"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { formatAuthors, formatDate } from "../site/formatting"
import { SiteSubnavigation } from "./SiteSubnavigation"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBook } from "@fortawesome/free-solid-svg-icons/faBook"
import { faSync } from "@fortawesome/free-solid-svg-icons/faSync"
import { faCreativeCommons } from "@fortawesome/free-brands-svg-icons/faCreativeCommons"
import { TableOfContents } from "../site/TableOfContents"
import {
    FormattedPost,
    FormattingOptions,
    TocHeading,
} from "../clientUtils/owidTypes"
import { Breadcrumb } from "./Breadcrumb/Breadcrumb"

export interface PageOverrides {
    pageTitle?: string
    citationTitle?: string
    citationSlug?: string
    citationCanonicalUrl?: string
    citationAuthors?: string[]
    citationPublicationDate?: Date
    canonicalUrl?: string
    excerpt?: string
}

export const LongFormPage = (props: {
    withCitation: boolean
    post: FormattedPost
    overrides?: PageOverrides
    formattingOptions: FormattingOptions
    baseUrl: string
}) => {
    const { withCitation, post, overrides, formattingOptions, baseUrl } = props

    const isPost = post.type === "post"

    const pageTitle = overrides?.pageTitle ?? post.title
    const pageTitleSEO = `${pageTitle}${
        post.supertitle ? ` - ${post.supertitle}` : ""
    }`
    const pageDesc = overrides?.excerpt ?? post.excerpt
    const canonicalUrl = overrides?.canonicalUrl ?? `${baseUrl}/${post.slug}`

    const citationTitle = overrides?.citationTitle ?? pageTitle
    const citationSlug = overrides?.citationSlug ?? post.slug
    const citationCanonicalUrl = overrides?.citationCanonicalUrl ?? canonicalUrl
    const citationPublicationDate =
        overrides?.citationPublicationDate ?? post.date
    const citationPublishedYear = citationPublicationDate.getFullYear()
    const citationAuthors = overrides?.citationAuthors ?? post.authors
    const citationAuthorsFormatted = formatAuthors(
        citationAuthors,
        withCitation
    )

    let hasSidebar = false
    const endNotes = { text: "Endnotes", slug: "endnotes" }
    const tocHeadings: TocHeading[] = [...post.tocHeadings]
    if (tocHeadings.some((tocHeading) => !tocHeading.isSubheading)) {
        hasSidebar = true
        if (post.footnotes.length) {
            tocHeadings.push({
                ...endNotes,
                isSubheading: false,
            })
        }
        if (withCitation) {
            tocHeadings.push(
                {
                    text: "Licence",
                    slug: "licence",
                    isSubheading: false,
                },
                {
                    text: "Citation",
                    slug: "citation",
                    isSubheading: false,
                }
            )
        }
    }

    const bodyClasses = []
    if (formattingOptions.bodyClassName) {
        bodyClasses.push(formattingOptions.bodyClassName)
    }

    const bibtex = `@article{owid${citationSlug.replace(/-/g, "")},
    author = {${citationAuthorsFormatted}},
    title = {${citationTitle}},
    journal = {Our World in Data},
    year = {${citationPublishedYear}},
    note = {${citationCanonicalUrl}}
}`

    return (
        <html>
            <Head
                pageTitle={pageTitleSEO}
                pageDesc={pageDesc}
                canonicalUrl={canonicalUrl}
                imageUrl={post.imageUrl}
                baseUrl={baseUrl}
            >
                {withCitation && (
                    <CitationMeta
                        title={citationTitle}
                        authors={citationAuthors}
                        date={citationPublicationDate}
                        canonicalUrl={citationCanonicalUrl}
                    />
                )}
            </Head>
            <body className={bodyClasses.join(" ")}>
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <article
                        className={`page${
                            hasSidebar ? " with-sidebar" : " no-sidebar"
                        }${isPost ? " thin-banner" : " large-banner"}`}
                    >
                        <div className="offset-header">
                            <header className="article-header">
                                <div className="article-titles">
                                    {post.supertitle && (
                                        <div className="supertitle">
                                            {post.supertitle}
                                        </div>
                                    )}
                                    <h1 className="entry-title">{pageTitle}</h1>
                                    {post.subtitle && (
                                        <div className="subtitle">
                                            {post.subtitle}
                                        </div>
                                    )}
                                    {formattingOptions.subnavId && (
                                        <Breadcrumb
                                            subnavId={
                                                formattingOptions.subnavId
                                            }
                                            subnavCurrentId={
                                                formattingOptions.subnavCurrentId
                                            }
                                        />
                                    )}
                                </div>
                                {!formattingOptions.hideAuthors && (
                                    <div className="authors-byline">
                                        {post.byline ? (
                                            <div
                                                dangerouslySetInnerHTML={{
                                                    __html: post.byline,
                                                }}
                                            ></div>
                                        ) : (
                                            <a href="/team">
                                                {`by ${formatAuthors(
                                                    post.authors,
                                                    withCitation
                                                )}`}
                                            </a>
                                        )}
                                    </div>
                                )}
                                {isPost && <time>{formatDate(post.date)}</time>}
                                {post.info && (
                                    <div
                                        className="blog-info"
                                        dangerouslySetInnerHTML={{
                                            __html: post.info,
                                        }}
                                    />
                                )}

                                {(isPost ||
                                    withCitation ||
                                    post.lastUpdated) && (
                                    <div className="tools">
                                        {post.lastUpdated && (
                                            <div className="last-updated">
                                                <FontAwesomeIcon
                                                    icon={faSync}
                                                />
                                                <span
                                                    dangerouslySetInnerHTML={{
                                                        __html: post.lastUpdated,
                                                    }}
                                                />
                                            </div>
                                        )}
                                        {(isPost || withCitation) && (
                                            <a href="#licence">
                                                <FontAwesomeIcon
                                                    icon={faCreativeCommons}
                                                />
                                                Reuse our work freely
                                            </a>
                                        )}
                                        {withCitation && (
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
                        {formattingOptions.subnavId && (
                            <SiteSubnavigation
                                subnavId={formattingOptions.subnavId}
                                subnavCurrentId={
                                    formattingOptions.subnavCurrentId
                                }
                            />
                        )}

                        <div className="content-wrapper">
                            {hasSidebar && (
                                <TableOfContents
                                    headings={tocHeadings}
                                    pageTitle={pageTitle}
                                    // hideSubheadings={true}
                                />
                            )}
                            <div className="offset-content">
                                <div className="content-and-footnotes">
                                    <div
                                        className="article-content"
                                        dangerouslySetInnerHTML={{
                                            __html: post.html,
                                        }}
                                    />
                                    <footer className="article-footer">
                                        <div className="wp-block-columns">
                                            <div className="wp-block-column">
                                                {post.footnotes.length ? (
                                                    <React.Fragment>
                                                        <h3 id={endNotes.slug}>
                                                            {endNotes.text}
                                                        </h3>
                                                        <ol className="endnotes">
                                                            {post.footnotes.map(
                                                                (
                                                                    footnote,
                                                                    i
                                                                ) => (
                                                                    <li
                                                                        key={i}
                                                                        id={`note-${
                                                                            i +
                                                                            1
                                                                        }`}
                                                                    >
                                                                        <p
                                                                            dangerouslySetInnerHTML={{
                                                                                __html: footnote,
                                                                            }}
                                                                        />
                                                                    </li>
                                                                )
                                                            )}
                                                        </ol>
                                                    </React.Fragment>
                                                ) : undefined}
                                                {(isPost || withCitation) && (
                                                    <>
                                                        <h3 id="licence">
                                                            Reuse our work
                                                            freely
                                                        </h3>

                                                        <p>
                                                            All visualizations,
                                                            data, and code
                                                            produced by Our
                                                            World in Data are
                                                            completely open
                                                            access under the{" "}
                                                            <a
                                                                href="https://creativecommons.org/licenses/by/4.0/"
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                Creative Commons
                                                                BY license
                                                            </a>
                                                            . You have the
                                                            permission to use,
                                                            distribute, and
                                                            reproduce these in
                                                            any medium, provided
                                                            the source and
                                                            authors are
                                                            credited.
                                                        </p>
                                                        <p>
                                                            The data produced by
                                                            third parties and
                                                            made available by
                                                            Our World in Data is
                                                            subject to the
                                                            license terms from
                                                            the original
                                                            third-party authors.
                                                            We will always
                                                            indicate the
                                                            original source of
                                                            the data in our
                                                            documentation, so
                                                            you should always
                                                            check the license of
                                                            any such third-party
                                                            data before use and
                                                            redistribution.
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
                                                {withCitation && (
                                                    <>
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
                                                            {
                                                                citationAuthorsFormatted
                                                            }{" "}
                                                            (
                                                            {
                                                                citationPublishedYear
                                                            }
                                                            ) - "{citationTitle}
                                                            ".{" "}
                                                            <em>
                                                                Published online
                                                                at
                                                                OurWorldInData.org.
                                                            </em>{" "}
                                                            Retrieved from: '
                                                            {
                                                                citationCanonicalUrl
                                                            }
                                                            ' [Online Resource]
                                                        </pre>
                                                        <p>BibTeX citation</p>
                                                        <pre className="citation">
                                                            {bibtex}
                                                        </pre>
                                                    </>
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
                                    href={formatWordpressEditLink(post.id)}
                                >
                                    Edit Page
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                <SiteFooter
                    hideDonate={formattingOptions.hideDonateFooter}
                    baseUrl={baseUrl}
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                        runTableOfContents(${JSON.stringify({
                            headings: tocHeadings,
                            pageTitle,
                            // hideSubheadings: true
                        })})
                        runRelatedCharts(${JSON.stringify(post.relatedCharts)})
                        `,
                    }}
                />
            </body>
        </html>
    )
}

export const formatWordpressEditLink = (postId: number) => {
    return `${WORDPRESS_URL}/wp/wp-admin/post.php?post=${postId}&action=edit`
}
