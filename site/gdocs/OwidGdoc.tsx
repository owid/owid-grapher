import React, { createContext } from "react"
import ReactDOM from "react-dom"
import cx from "classnames"
import { ArticleBlocks } from "./ArticleBlocks.js"
import Footnotes from "./Footnotes.js"
import {
    LinkedChart,
    OwidGdocPostInterface,
    getOwidGdocFromJSON,
    ImageMetadata,
    RelatedChart,
    CITATION_ID,
    LICENSE_ID,
    isEmpty,
    OwidGdocType,
    formatAuthors,
} from "@ourworldindata/utils"
import { CodeSnippet } from "@ourworldindata/components"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import { DebugProvider } from "./DebugContext.js"
import { OwidGdocHeader } from "./OwidGdocHeader.js"
import StickyNav from "../blocks/StickyNav.js"
import { getShortPageCitation } from "./utils.js"
import { TableOfContents } from "../TableOfContents.js"
export const AttachmentsContext = createContext<{
    linkedCharts: Record<string, LinkedChart>
    linkedDocuments: Record<string, OwidGdocPostInterface>
    imageMetadata: Record<string, ImageMetadata>
    relatedCharts: RelatedChart[]
}>({
    linkedDocuments: {},
    imageMetadata: {},
    linkedCharts: {},
    relatedCharts: [],
})

export const DocumentContext = createContext<{ isPreviewing: boolean }>({
    isPreviewing: false,
})

type OwidGdocProps = OwidGdocPostInterface & {
    isPreviewing?: boolean
}

const citationDescriptionsByArticleType: Record<OwidGdocType, string> = {
    [OwidGdocType.TopicPage]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this topic page, please also cite the underlying data sources. This topic page can be cited as:",
    [OwidGdocType.LinearTopicPage]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this topic page, please also cite the underlying data sources. This topic page can be cited as:",
    [OwidGdocType.Article]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this article, please also cite the underlying data sources. This article can be cited as:",
    // This case should never occur as Fragments aren't baked and can't be viewed by themselves.
    [OwidGdocType.Fragment]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this text, please also cite the underlying data sources. This text can be cited as:",
}

export function OwidGdoc({
    content,
    publishedAt,
    slug,
    breadcrumbs,
    linkedCharts = {},
    linkedDocuments = {},
    imageMetadata = {},
    relatedCharts = [],
    isPreviewing = false,
}: OwidGdocProps) {
    const citationDescription =
        citationDescriptionsByArticleType[content.type ?? OwidGdocType.Article]
    const shortPageCitation = getShortPageCitation(
        content.authors,
        content.title ?? "",
        publishedAt
    )
    const citationText = `${shortPageCitation} Published online at OurWorldInData.org. Retrieved from: '${`${BAKED_BASE_URL}/${slug}`}' [Online Resource]`
    const hasSidebarToc = content["sidebar-toc"]

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
        <AttachmentsContext.Provider
            value={{
                linkedDocuments,
                imageMetadata,
                linkedCharts,
                relatedCharts,
            }}
        >
            <DocumentContext.Provider value={{ isPreviewing }}>
                <div id="gdoc-admin-bar">
                    <a href="#" id="gdoc-link">
                        Gdoc
                    </a>
                    <span>/</span>
                    <a href="#" id="admin-link">
                        Admin
                    </a>
                </div>
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
                        authors={content.authors}
                        publishedAt={publishedAt}
                        breadcrumbs={breadcrumbs ?? undefined}
                    />
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
                        <ArticleBlocks
                            toc={content.toc}
                            blocks={content.body}
                        />
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
                                <h3>Cite this work</h3>
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
                            <img
                                src={`${BAKED_BASE_URL}/owid-logo.svg`}
                                className="img-raw"
                                alt="Our World in Data logo"
                            />
                            <h3>Reuse this work freely</h3>

                            <p>
                                All visualizations, data, and code produced by
                                Our World in Data are completely open access
                                under the{" "}
                                <a
                                    href="https://creativecommons.org/licenses/by/4.0/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Creative Commons BY license
                                </a>
                                . You have the permission to use, distribute,
                                and reproduce these in any medium, provided the
                                source and authors are credited.
                            </p>
                            <p>
                                The data produced by third parties and made
                                available by Our World in Data is subject to the
                                license terms from the original third-party
                                authors. We will always indicate the original
                                source of the data in our documentation, so you
                                should always check the license of any such
                                third-party data before use and redistribution.
                            </p>
                            <p>
                                All of{" "}
                                <a href="/how-to-use-our-world-in-data#how-to-embed-interactive-charts-in-your-article">
                                    our charts can be embedded
                                </a>{" "}
                                in any site.
                            </p>
                        </div>
                    </section>
                </article>
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}

export const hydrateOwidGdoc = (debug?: boolean, isPreviewing?: boolean) => {
    const wrapper = document.querySelector("#owid-document-root")
    const props = getOwidGdocFromJSON(window._OWID_GDOC_PROPS)
    ReactDOM.hydrate(
        <React.StrictMode>
            <DebugProvider debug={debug}>
                <OwidGdoc {...props} isPreviewing={isPreviewing} />
            </DebugProvider>
        </React.StrictMode>,
        wrapper
    )
}
