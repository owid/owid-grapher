import * as _ from "lodash-es"
import { Fragment } from "react"
import { Head } from "./Head.js"
import { CitationMeta } from "./CitationMeta.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { addContentFeatures, formatUrls } from "../site/formatting.js"
import { SiteSubnavigation } from "./SiteSubnavigation.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faBook } from "@fortawesome/free-solid-svg-icons"
import { faCreativeCommons } from "@fortawesome/free-brands-svg-icons"
import { TableOfContents } from "../site/TableOfContents.js"
import {
    FormattedPost,
    TocHeading,
    formatAuthors,
    formatAuthorsForBibtex,
} from "@ourworldindata/utils"
import { FormattingOptions } from "@ourworldindata/types"
import { BreadcrumbsFromSubnav } from "./Breadcrumb/Breadcrumb.js"
import { Byline } from "./Byline.js"
import { PageInfo } from "./PageInfo.js"
import { BackToTopic } from "./BackToTopic.js"
import StickyNav from "./blocks/StickyNav.js"
import { CodeSnippet } from "@ourworldindata/components"
import { Html } from "./Html.js"

export interface PageOverrides {
    pageTitle?: string
    pageDesc?: string
    canonicalUrl?: string
    citationTitle?: string
    citationSlug?: string
    citationCanonicalUrl?: string
    citationAuthors?: string[]
    citationPublicationDate?: Date
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
    const pageDesc = overrides?.pageDesc ?? post.pageDesc
    const canonicalUrl = overrides?.canonicalUrl ?? `${baseUrl}/${post.slug}`

    const citationTitle = overrides?.citationTitle ?? pageTitle
    const citationSlug = overrides?.citationSlug ?? post.slug
    const citationCanonicalUrl = overrides?.citationCanonicalUrl ?? canonicalUrl
    const citationPublicationDate =
        overrides?.citationPublicationDate ?? post.date
    const citationPublishedYear = citationPublicationDate.getFullYear()
    const citationAuthors = overrides?.citationAuthors ?? post.authors

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

    const tocHeadingsNoHtml: Array<Omit<TocHeading, "html">> = tocHeadings.map(
        (tocHeading) => _.omit(tocHeading, "html")
    )

    const bodyClasses = []
    if (formattingOptions.bodyClassName) {
        bodyClasses.push(formattingOptions.bodyClassName)
    }

    const citationText = `${formatAuthors(citationAuthors)} (${citationPublishedYear}) - "${citationTitle}". Published online at OurWorldinData.org. Retrieved from: '${citationCanonicalUrl}' [Online Resource]`

    const bibtex = `@article{owid${citationSlug.replace(/-/g, "")},
    author = {${formatAuthorsForBibtex(citationAuthors)}},
    title = {${citationTitle}},
    journal = {Our World in Data},
    year = {${citationPublishedYear}},
    note = {${citationCanonicalUrl}}
}`
    return (
        <Html>
            <Head
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                canonicalUrl={canonicalUrl}
                imageUrl={
                    // uriEncoding is taken care of inside the Head component
                    post.imageUrl ? formatUrls(post.imageUrl) : undefined
                }
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
                <SiteHeader />
                <main>
                    <article
                        className={`page${
                            hasSidebar ? " with-sidebar" : " no-sidebar"
                        }${isPost ? " thin-banner" : " large-banner"}`}
                    >
                        <div className="offset-header">
                            <header className="article-header">
                                {isPost && formattingOptions.subnavId && (
                                    <BackToTopic
                                        subnavId={formattingOptions.subnavId}
                                    />
                                )}
                                <div className="article-titles">
                                    <h1 className="entry-title">{pageTitle}</h1>
                                    {!isPost && formattingOptions.subnavId && (
                                        <BreadcrumbsFromSubnav
                                            subnavId={
                                                formattingOptions.subnavId
                                            }
                                            subnavCurrentId={
                                                formattingOptions.subnavCurrentId
                                            }
                                        />
                                    )}
                                </div>
                                {!isPost && (
                                    <>
                                        {!formattingOptions.hideAuthors && (
                                            <Byline
                                                authors={post.authors}
                                                override={post.byline}
                                            />
                                        )}
                                        {post.info && (
                                            <PageInfo info={post.info} />
                                        )}

                                        {withCitation && (
                                            <div className="tools">
                                                <a href="#licence">
                                                    <FontAwesomeIcon
                                                        icon={faCreativeCommons}
                                                    />
                                                    Reuse our work freely
                                                </a>
                                                <a href="#citation">
                                                    <FontAwesomeIcon
                                                        icon={faBook}
                                                    />
                                                    Cite this research
                                                </a>
                                            </div>
                                        )}
                                    </>
                                )}
                            </header>
                        </div>
                        {post.stickyNavLinks?.length ? (
                            <nav className="sticky-nav sticky-nav--dark">
                                <StickyNav links={post.stickyNavLinks} />
                            </nav>
                        ) : null}
                        {!isPost && formattingOptions.subnavId && (
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
                                    headings={tocHeadingsNoHtml}
                                    pageTitle={pageTitle}
                                    // hideSubheadings={true}
                                />
                            )}
                            <div className="offset-content">
                                <div className="content-and-footnotes">
                                    <div
                                        className="article-content"
                                        dangerouslySetInnerHTML={{
                                            __html: addContentFeatures({
                                                post,
                                                formattingOptions,
                                            }),
                                        }}
                                    />
                                    <footer className="article-footer">
                                        <div className="wp-block-columns">
                                            <div className="wp-block-column">
                                                {isPost && post.info && (
                                                    <PageInfo
                                                        info={post.info}
                                                    />
                                                )}
                                                {post.footnotes.length ? (
                                                    <Fragment>
                                                        <h3
                                                            id={endNotes.slug}
                                                            className="h3-bold"
                                                        >
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
                                                    </Fragment>
                                                ) : undefined}
                                                {withCitation && (
                                                    <>
                                                        <h3
                                                            id="citation"
                                                            className="h3-bold"
                                                        >
                                                            Cite this work
                                                        </h3>
                                                        <p>
                                                            Our articles and
                                                            data visualizations
                                                            rely on work from
                                                            many different
                                                            people and
                                                            organizations. When
                                                            citing this topic
                                                            page, please also
                                                            cite the underlying
                                                            data sources. This
                                                            topic page can be
                                                            cited as:
                                                        </p>
                                                        <div>
                                                            <CodeSnippet
                                                                code={
                                                                    citationText
                                                                }
                                                            />
                                                        </div>
                                                        <p>BibTeX citation</p>

                                                        <div>
                                                            <CodeSnippet
                                                                code={bibtex}
                                                            />
                                                        </div>
                                                        <hr
                                                            style={{
                                                                paddingBottom: 0,
                                                            }}
                                                        />
                                                    </>
                                                )}
                                                {(isPost || withCitation) && (
                                                    <>
                                                        <h3
                                                            id="licence"
                                                            className="h3-bold"
                                                        >
                                                            Reuse this work
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
                                                                rel="noopener"
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
                                                            <a href="/faqs#how-can-i-embed-one-of-your-interactive-charts-in-my-website">
                                                                our charts can
                                                                be embedded
                                                            </a>{" "}
                                                            in any site.
                                                        </p>
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
                <SiteFooter hideDonate={formattingOptions.hideDonateFooter} />
                <script
                    type="module"
                    dangerouslySetInnerHTML={{
                        __html: `
                        runTableOfContents(${JSON.stringify({
                            // headings might contain </script> tags in their
                            // html property (which break the page JS, see
                            // #1256). This comes from {{DataValue}}
                            // (transformed into AnnotatingDataValue) tags used
                            // within <h3>s.
                            headings: tocHeadingsNoHtml,
                            pageTitle,
                            // hideSubheadings: true
                        })})
                        `,
                    }}
                />
            </body>
        </Html>
    )
}
