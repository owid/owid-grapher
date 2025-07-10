import cx from "classnames"
import {
    BreadcrumbItem,
    CITATION_ID,
    LICENSE_ID,
    OwidGdocPostContent,
    OwidGdocType,
    formatDate,
} from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faBook } from "@fortawesome/free-solid-svg-icons"
import { faCreativeCommons } from "@fortawesome/free-brands-svg-icons"
import Image from "./Image.js"
import { Breadcrumbs } from "../../Breadcrumb/Breadcrumb.js"
import { breadcrumbColorForCoverColor } from "../utils.js"
import { Byline } from "./Byline.js"

function OwidArticleHeader({
    content,
    publishedAt,
    breadcrumbs,
    isDeprecated,
}: {
    content: OwidGdocPostContent
    publishedAt: Date | null
    breadcrumbs?: BreadcrumbItem[]
    isDeprecated?: boolean
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
            {!!breadcrumbs?.length && (
                <div className="centered-article-header__breadcrumbs-container col-start-4 span-cols-8 col-md-start-2 span-md-cols-12">
                    <Breadcrumbs
                        items={breadcrumbs}
                        className={`centered-article-header__breadcrumbs breadcrumbs-${breadcrumbColor}`}
                    />
                </div>
            )}
            <header
                className={cx(
                    "centered-article-header align-center grid",
                    "grid-cols-8 span-cols-8 col-start-4",
                    "grid-md-cols-6 span-md-cols-12 col-md-start-2"
                )}
            >
                <div className="centered-article-header__title-container col-start-2 span-cols-6 span-md-cols-6 col-md-start-1">
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
                    <h2 className="centered-article-header__subtitle col-start-2 span-cols-6 span-md-cols-6 col-md-start-1">
                        {content.subtitle}
                    </h2>
                ) : null}
                <div className="centered-article-header__meta-container col-start-2 span-cols-6 span-md-cols-6 col-md-start-1 grid grid-cols-2 ">
                    <div
                        className={
                            isDeprecated
                                ? "span-cols-2"
                                : "span-cols-1 span-sm-cols-2"
                        }
                    >
                        {content.authors.length > 0 && (
                            <div className="centered-article-header__byline">
                                <Byline names={content.authors} />
                            </div>
                        )}
                        <div className="centered-article-header__dateline body-3-medium-italic">
                            {content.dateline ||
                                (publishedAt && formatDate(publishedAt))}
                        </div>
                    </div>
                    {!isDeprecated && (
                        <div className="centered-article-header__links span-cols-1 span-sm-cols-2">
                            {!content["hide-citation"] && (
                                <a
                                    href="#article-citation"
                                    className="body-1-regular display-block"
                                >
                                    <FontAwesomeIcon icon={faBook} />
                                    Cite this article
                                </a>
                            )}

                            <a
                                href="#article-licence"
                                className="body-3-medium display-block"
                            >
                                <FontAwesomeIcon icon={faCreativeCommons} />
                                Reuse our work freely
                            </a>
                        </div>
                    )}
                </div>
            </header>
        </>
    )
}

function OwidTopicPageHeader({ content }: { content: OwidGdocPostContent }) {
    return (
        <header className="topic-page-header grid span-cols-14 grid-cols-12-full-width">
            <h1 className="display-1-semibold col-start-2 span-cols-8 col-sm-start-2 span-sm-cols-12">
                {content.title}
            </h1>
            <p className="topic-page-header__subtitle body-1-regular col-start-2 span-cols-8 col-sm-start-2 span-sm-cols-12">
                {content.subtitle}
            </p>
            {content.authors.length > 0 && (
                <p className="topic-page-header__byline col-start-2 span-cols-8 col-sm-start-2 span-sm-cols-12">
                    <Byline names={content.authors} />
                </p>
            )}
            <div className="topic-page-header__cta-buttons col-start-2 span-cols-8 col-sm-start-2 span-sm-cols-12">
                <a href={`#${CITATION_ID}`}>
                    <FontAwesomeIcon icon={faBook} />
                    Cite this work
                </a>
                <a href={`#${LICENSE_ID}`}>
                    <FontAwesomeIcon icon={faCreativeCommons} />
                    Reuse this work
                </a>
            </div>
        </header>
    )
}

function OwidLinearTopicPageHeader({
    content,
}: {
    content: OwidGdocPostContent
}) {
    return (
        <header className="topic-page-header grid span-cols-14 grid-cols-12-full-width">
            <h1 className="display-1-semibold col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2">
                {content.title}
            </h1>
            <p className="topic-page-header__subtitle body-1-regular col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2">
                {content.subtitle}
            </p>
            {content.authors.length > 0 && (
                <p className="topic-page-header__byline col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2">
                    <Byline names={content.authors} />
                </p>
            )}
            <p className="topic-page-header__dateline body-3-medium-italic col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2">
                {content.dateline}
            </p>
        </header>
    )
}

export function OwidGdocHeader(props: {
    content: OwidGdocPostContent
    publishedAt: Date | null
    breadcrumbs?: BreadcrumbItem[]
    isDeprecated?: boolean
}) {
    if (props.content.type === OwidGdocType.Article)
        return <OwidArticleHeader {...props} />
    if (props.content.type === OwidGdocType.TopicPage)
        return <OwidTopicPageHeader {...props} />
    if (props.content.type === OwidGdocType.LinearTopicPage)
        return <OwidLinearTopicPageHeader {...props} />
    // Defaulting to ArticleHeader, but will require the value to be set for all docs going forward
    return <OwidArticleHeader {...props} />
}
