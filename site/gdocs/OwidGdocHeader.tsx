import React from "react"
import {
    OwidGdocContent,
    OwidGdocType,
    formatDate,
} from "@ourworldindata/utils"
import { formatAuthors } from "../clientFormatting.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faBook } from "@fortawesome/free-solid-svg-icons"
import { faCreativeCommons } from "@fortawesome/free-brands-svg-icons"

function OwidArticleHeader({
    content,
    authors,
    publishedAt,
}: {
    content: OwidGdocContent
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
    content: OwidGdocContent
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

export function OwidGdocHeader(props: {
    content: OwidGdocContent
    authors: string[]
    publishedAt: Date | null
}) {
    if (props.content.type === OwidGdocType.Article)
        return <OwidArticleHeader {...props} />
    if (props.content.type === OwidGdocType.TopicPage)
        return <OwidTopicPageHeader {...props} />
    // Defaulting to ArticleHeader, but will require the value to be set for all docs going forward
    return <OwidArticleHeader {...props} />
}
