import React from "react"
import cx from "classnames"
import {
    BreadcrumbItem,
    OwidGdocContent,
    OwidGdocType,
    formatDate,
} from "@ourworldindata/utils"
import { formatAuthors } from "../clientFormatting.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faBook } from "@fortawesome/free-solid-svg-icons"
import { faCreativeCommons } from "@fortawesome/free-brands-svg-icons"
import Image from "./Image.js"
import { Breadcrumbs } from "../Breadcrumb/Breadcrumb.js"
import { breadcrumbColorForCoverColor } from "./utils.js"

function OwidArticleHeader({
    content,
    authors,
    publishedAt,
    breadcrumbs,
}: {
    content: OwidGdocContent
    authors: string[]
    publishedAt: Date | null
    breadcrumbs?: BreadcrumbItem[]
}) {
    const coverStyle = content["cover-color"]
        ? { backgroundColor: `var(--${content["cover-color"]})` }
        : undefined

    const breadcrumbColor = breadcrumbColorForCoverColor(content["cover-color"])

    return (
        <>
            <div
                className="centered-article-header__banner"
                style={coverStyle}
            ></div>
            {content["cover-image"] ? (
                <div className="centered-article-header__cover-image span-cols-14">
                    <Image
                        filename={content["cover-image"]}
                        containerType="full-width"
                        shouldLightbox={false}
                    />
                </div>
            ) : null}
            {breadcrumbs?.length && (
                <div className="centered-article-header__breadcrumbs-container col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                    <Breadcrumbs
                        items={breadcrumbs}
                        className={`centered-article-header__breadcrumbs breadcrumbs-${breadcrumbColor}`}
                    />
                </div>
            )}
            <header
                className={cx(
                    "centered-article-header align-center grid grid-cols-8 col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12"
                )}
            >
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
            <p className="topic-page-header__byline col-start-2 span-cols-8 col-sm-start-2 span-sm-cols-12">
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
    breadcrumbs?: BreadcrumbItem[]
}) {
    if (props.content.type === OwidGdocType.Article)
        return <OwidArticleHeader {...props} />
    if (props.content.type === OwidGdocType.TopicPage)
        return <OwidTopicPageHeader {...props} />
    // Defaulting to ArticleHeader, but will require the value to be set for all docs going forward
    return <OwidArticleHeader {...props} />
}
