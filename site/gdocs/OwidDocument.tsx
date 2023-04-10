import React, { createContext } from "react"
import ReactDOM from "react-dom"
import { ArticleBlocks } from "./ArticleBlocks.js"
import Footnotes from "./Footnotes.js"
import {
    OwidDocumentInterface,
    formatDate,
    getDocumentFromJSON,
    ImageMetadata,
    OwidDocumentContent,
    OwidDocumentType,
} from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faBook } from "@fortawesome/free-solid-svg-icons"
import { faCreativeCommons } from "@fortawesome/free-brands-svg-icons"
import { CodeSnippet } from "../blocks/CodeSnippet.js"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import { formatAuthors } from "../clientFormatting.js"
import { DebugProvider } from "./DebugContext.js"

function OwidArticleHeader({
    content,
    authors,
    publishedAt,
}: {
    content: OwidDocumentContent
    authors: string[]
    publishedAt: Date | null
}) {
    const coverStyle = content["cover-image"]
        ? {
              background: `url(${content["cover-image"][0].value.src})`,
              backgroundSize: "cover",
          }
        : content["cover-color"]
        ? { backgroundColor: `var(--${content["cover-color"]})` }
        : {}
    return (
        <>
            <div className="article-banner" style={coverStyle}></div>
            <header className="centered-article-header align-center grid grid-cols-8 col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                <div className="centered-article-header__title-container col-start-2 span-cols-6">
                    {content.supertitle ? (
                        <h3 className="centered-article-header__supertitle span-cols-8">
                            {content.supertitle}
                        </h3>
                    ) : null}
                    <h1 className="centered-article-header__title">
                        {content.title}
                    </h1>
                </div>
                {content.subtitle ? (
                    <h2 className="centered-article-header__subtitle col-start-2 span-cols-6">
                        {content.subtitle}
                    </h2>
                ) : null}
                <div className="centered-article-header__meta-container col-start-2 span-cols-6 grid grid-cols-2">
                    <div className="span-cols-1 span-sm-cols-2">
                        <div className="centered-article-header__byline">
                            {"By: "}
                            <a href="/team">
                                {formatAuthors({
                                    authors,
                                })}
                            </a>
                        </div>
                        <div className="centered-article-header__dateline body-3-medium-italic">
                            {content.dateline ||
                                (publishedAt && formatDate(publishedAt))}
                        </div>
                    </div>
                    <div className="span-cols-1 span-sm-cols-2">
                        <a
                            href="#article-citation"
                            className="body-1-regular display-block"
                        >
                            <FontAwesomeIcon icon={faBook} />
                            Cite this article
                        </a>

                        <a
                            href="#article-licence"
                            className="body-3-medium display-block"
                        >
                            <FontAwesomeIcon icon={faCreativeCommons} />
                            Reuse our work freely
                        </a>
                    </div>
                </div>
            </header>
        </>
    )
}

function OwidTopicPageHeader({
    content,
    authors,
}: {
    content: OwidDocumentContent
    authors: string[]
}) {
    return (
        <header className="topic-page-header grid span-cols-14 grid-cols-12-full-width">
            <h1 className="display-1-semibold col-start-2 span-cols-8">
                {content.title}
            </h1>
            <p className="topic-page-header__subtitle body-1-regular col-start-2 span-cols-8">
                {content.subtitle}
            </p>
            <p className="topic-page-header__byline col-start-2 span-cols-8">
                {"By "}
                <a href="/team">
                    {formatAuthors({
                        authors,
                    })}
                </a>
            </p>
        </header>
    )
}

function OwidDocumentHeader(props: {
    content: OwidDocumentContent
    authors: string[]
    publishedAt: Date | null
}) {
    if (props.content.type === OwidDocumentType.Article)
        return <OwidArticleHeader {...props} />
    if (props.content.type === OwidDocumentType.TopicPage)
        return <OwidTopicPageHeader {...props} />
    return null
}

export const AttachmentsContext = createContext<{
    linkedDocuments: Record<string, OwidDocumentInterface>
    imageMetadata: Record<string, ImageMetadata>
}>({ linkedDocuments: {}, imageMetadata: {} })

export const DocumentContext = createContext<{ isPreviewing: boolean }>({
    isPreviewing: false,
})

type OwidDocumentProps = OwidDocumentInterface & {
    isPreviewing?: boolean
}

export function OwidDocument({
    content,
    publishedAt,
    slug,
    linkedDocuments = {},
    imageMetadata = {},
    isPreviewing = false,
}: OwidDocumentProps) {
    // Until authors comes as structured data, we need to parse them from the byline string
    const authors = content?.byline?.replace(/\s*,\s*/g, ",").split(",") || [
        "Our World in Data",
    ]

    const citationText = `${formatAuthors({
        authors,
    })} (${publishedAt?.getFullYear()}) - "${
        content.title
    }". Published online at OurWorldInData.org. Retrieved from: '${`${BAKED_BASE_URL}/${slug}`}' [Online Resource]`

    const bibtex = `@article{owid${slug.replace(/-/g, "")},
    author = {${formatAuthors({
        authors,
        forBibtex: true,
    })}},
    title = {${content.title}},
    journal = {Our World in Data},
    year = {${publishedAt?.getFullYear()}},
    note = {${BAKED_BASE_URL}/${slug}}
}`

    return (
        <AttachmentsContext.Provider value={{ linkedDocuments, imageMetadata }}>
            <DocumentContext.Provider value={{ isPreviewing }}>
                <article className="centered-article-container grid grid-cols-12-full-width">
                    <OwidDocumentHeader
                        content={content}
                        authors={authors}
                        publishedAt={publishedAt}
                    />
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

                    {content.refs ? <Footnotes d={content.refs} /> : null}

                    <section
                        id="article-citation"
                        className="grid grid-cols-12-full-width col-start-1 col-end-limit"
                    >
                        <div className="col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                            <h3>Cite this work</h3>
                            <p>
                                Our articles and data visualizations rely on
                                work from many different people and
                                organizations. When citing this topic page,
                                please also cite the underlying data sources.
                                This topic page can be cited as:
                            </p>
                            {/* TODO? renderSpans(content.citation.map((block) => block.value)) */}
                            <div>
                                <CodeSnippet code={citationText} />
                            </div>
                            <p>BibTeX citation</p>
                            <div>
                                <CodeSnippet code={bibtex} />
                            </div>
                        </div>
                    </section>

                    <section
                        id="article-licence"
                        className="grid grid-cols-12-full-width col-start-1 col-end-limit"
                    >
                        <div className="col-start-6 span-cols-4 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
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

export const hydrateOwidDocument = (
    debug?: boolean,
    isPreviewing?: boolean
) => {
    const wrapper = document.querySelector("#owid-article-root")
    const props = getDocumentFromJSON(window._OWID_DOCUMENT_PROPS)
    ReactDOM.hydrate(
        <React.StrictMode>
            <DebugProvider debug={debug}>
                <OwidDocument {...props} isPreviewing={isPreviewing} />
            </DebugProvider>
        </React.StrictMode>,
        wrapper
    )
}
