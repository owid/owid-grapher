import React from "react"
import cx from "classnames"
import { useIntersectionObserver } from "usehooks-ts"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBoxArchive } from "@fortawesome/free-solid-svg-icons"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import Footnotes from "../components/Footnotes.js"
import {
    OwidGdocPostInterface,
    CITATION_ID,
    LICENSE_ID,
    isEmpty,
    OwidGdocType,
    formatAuthors,
    EnrichedBlockText,
} from "@ourworldindata/utils"
import { CodeSnippet } from "@ourworldindata/components"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"
import { OwidGdocHeader } from "../components/OwidGdocHeader.js"
import StickyNav from "../../blocks/StickyNav.js"
import { getShortPageCitation } from "../utils.js"
import { TableOfContents } from "../../TableOfContents.js"

const citationDescriptionsByArticleType: Record<
    | OwidGdocType.Article
    | OwidGdocType.TopicPage
    | OwidGdocType.LinearTopicPage
    | OwidGdocType.Fragment
    | OwidGdocType.AboutPage,
    string
> = {
    [OwidGdocType.TopicPage]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this topic page, please also cite the underlying data sources. This topic page can be cited as:",
    [OwidGdocType.LinearTopicPage]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this topic page, please also cite the underlying data sources. This topic page can be cited as:",
    [OwidGdocType.Article]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this article, please also cite the underlying data sources. This article can be cited as:",
    // This case should never occur as Fragments aren't baked and can't be viewed by themselves.
    [OwidGdocType.Fragment]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this text, please also cite the underlying data sources. This text can be cited as:",
    // It is unlikely that we would want to cite an about page, but there might be a use case for it.
    [OwidGdocType.AboutPage]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this page, please also cite the underlying data sources. This page can be cited as:",
}

export function GdocPost({
    content,
    publishedAt,
    slug,
    breadcrumbs,
}: OwidGdocPostInterface & {
    isPreviewing?: boolean
}) {
    const postType = content.type ?? OwidGdocType.Article
    const citationDescription = citationDescriptionsByArticleType[postType]
    const shortPageCitation = getShortPageCitation(
        content.authors,
        content.title ?? "",
        publishedAt
    )
    const citationText = `${shortPageCitation} Published online at OurWorldInData.org. Retrieved from: '${`${BAKED_BASE_URL}/${slug}`}' [Online Resource]`
    const hasSidebarToc = content["sidebar-toc"]
    const isDeprecated = Boolean(content["deprecation-notice"])

    const bibtex = `@article{owid-${slug.replace(/\//g, "-")},
    author = {${formatAuthors({
        authors: content.authors,
        forBibtex: true,
    })}},
    title = {${content.title}},
    journal = {Our World in Data},
    year = {${publishedAt?.getFullYear()}},
    note = {${BAKED_BASE_URL}/${slug}}
}`

    const stickyNavLinks = content["sticky-nav"]

    return (
        <article
            className={cx(
                "centered-article-container grid grid-cols-12-full-width",
                // Only add this modifier class when content.type is defined
                {
                    [`centered-article-container--${content.type}`]:
                        content.type,
                }
            )}
        >
            <OwidGdocHeader
                content={content}
                publishedAt={publishedAt}
                breadcrumbs={breadcrumbs ?? undefined}
                isDeprecated={isDeprecated}
            />
            {content["deprecation-notice"] && (
                <DeprecationNotice blocks={content["deprecation-notice"]} />
            )}
            {hasSidebarToc && content.toc ? (
                <TableOfContents
                    headings={content.toc}
                    headingLevels={{ primary: 1, secondary: 2 }}
                    pageTitle={content.title || ""}
                />
            ) : null}
            {content.type === "topic-page" && stickyNavLinks?.length ? (
                <nav className="sticky-nav sticky-nav--dark span-cols-14 grid grid-cols-12-full-width">
                    <StickyNav
                        links={stickyNavLinks}
                        className="span-cols-12 col-start-2"
                    />
                </nav>
            ) : null}

            {content.summary ? (
                <details
                    className="article-summary col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12"
                    open={true}
                >
                    <summary>Summary</summary>
                    <ArticleBlocks
                        blocks={content.summary}
                        containerType="summary"
                    />
                </details>
            ) : null}

            {content.body ? (
                <ArticleBlocks toc={content.toc} blocks={content.body} />
            ) : null}

            {content.refs && !isEmpty(content.refs.definitions) ? (
                <Footnotes definitions={content.refs.definitions} />
            ) : null}

            {!content["hide-citation"] && (
                <section
                    id={CITATION_ID}
                    className="grid grid-cols-12-full-width col-start-1 col-end-limit"
                >
                    <div className="col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                        <h3
                            className={
                                isDeprecated ? "align-left" : "align-center"
                            }
                        >
                            Cite this work
                        </h3>
                        {isDeprecated && (
                            <p className="citation-deprecated-notice">
                                <span className="citation-deprecated-notice__highlight">
                                    This content is outdated
                                </span>{" "}
                                but if you would still like to use it, here is
                                how to cite it.
                                <br />
                            </p>
                        )}
                        <p>{citationDescription}</p>
                        <div>
                            <CodeSnippet code={citationText} />
                        </div>
                        <p>BibTeX citation</p>
                        <div>
                            <CodeSnippet code={bibtex} />
                        </div>
                    </div>
                </section>
            )}

            <section
                id={LICENSE_ID}
                className="grid grid-cols-12-full-width col-start-1 col-end-limit"
            >
                <div className="col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                    {!isDeprecated && (
                        <>
                            <img
                                src={`${BAKED_BASE_URL}/owid-logo.svg`}
                                className="img-raw"
                                alt="Our World in Data logo"
                            />
                            <h3>Reuse this work freely</h3>
                        </>
                    )}

                    <p>
                        All visualizations, data, and code produced by Our World
                        in Data are completely open access under the{" "}
                        <a
                            href="https://creativecommons.org/licenses/by/4.0/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Creative Commons BY license
                        </a>
                        . You have the permission to use, distribute, and
                        reproduce these in any medium, provided the source and
                        authors are credited.
                    </p>
                    <p>
                        The data produced by third parties and made available by
                        Our World in Data is subject to the license terms from
                        the original third-party authors. We will always
                        indicate the original source of the data in our
                        documentation, so you should always check the license of
                        any such third-party data before use and redistribution.
                    </p>
                    {!isDeprecated && (
                        <p>
                            All of{" "}
                            <a href="/faqs#how-can-i-embed-one-of-your-interactive-charts-in-my-website">
                                our charts can be embedded
                            </a>{" "}
                            in any site.
                        </p>
                    )}
                </div>
            </section>
        </article>
    )
}

function DeprecationNotice({ blocks }: { blocks: EnrichedBlockText[] }) {
    const { isIntersecting, ref } = useIntersectionObserver()
    return (
        <>
            {/* Non-sticky sentinel element for observing intersection. */}
            <div className="col-start-1 span-cols-14" ref={ref} />
            <div
                className={cx(
                    "deprecation-notice col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12",
                    {
                        "deprecation-notice--sticky": !isIntersecting,
                    }
                )}
            >
                <h4 className="deprecation-notice__heading">
                    <FontAwesomeIcon
                        className="deprecation-notice__icon"
                        icon={faBoxArchive}
                    />
                    This article is outdated
                </h4>
                <ArticleBlocks blocks={blocks} />
            </div>
        </>
    )
}
