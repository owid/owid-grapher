import * as React from "react"
import { formatAuthors, OwidGdocType } from "@ourworldindata/utils"
import { ImageMetadata, PageChronologicalRecord } from "@ourworldindata/types"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import Image from "../gdocs/components/Image.js"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"
import DataInsightDateline from "../gdocs/components/DataInsightDateline.js"
import LinkedAuthorComponent from "../gdocs/components/LinkedAuthor.js"
import { Cta } from "../gdocs/components/Cta.js"
import { ExpandableParagraph } from "../blocks/ExpandableParagraph.js"
import cx from "classnames"

const COMMON_CLASSES =
    "grid grid-cols-8 span-cols-8 col-start-2 span-md-cols-10 col-md-start-2 span-sm-cols-14 col-sm-start-1"

function makeAttachments(hit: PageChronologicalRecord) {
    return {
        imageMetadata: (hit.imageMetadata ?? {}) as Record<
            string,
            ImageMetadata
        >,
        linkedAuthors: hit.linkedAuthors ?? [],
        linkedCharts: hit.linkedCharts ?? {},
        linkedDocuments: hit.linkedDocuments ?? {},
        linkedIndicators: {},
        relatedCharts: [],
        tags: [],
    }
}

const LatestArticleCard = ({ hit }: { hit: PageChronologicalRecord }) => {
    const href = getPrefixedGdocPath("", {
        slug: hit.slug,
        content: { type: OwidGdocType.Article },
    })
    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                className={cx("latest-page__article", COMMON_CLASSES)}
            >
                <DataInsightDateline
                    publishedAt={new Date(hit.date)}
                    className="latest-page__item-dateline h6-black-caps span-cols-4"
                />
                <p className="latest-page__item-type h6-black-caps span-cols-4 col-start-5">
                    Article
                </p>
                <a
                    href={href}
                    aria-label={hit.title}
                    className="latest-page__article-link span-cols-8"
                >
                    {hit.featuredImage && (
                        <Image
                            filename={hit.featuredImage}
                            className="latest-page__article-image"
                            shouldLightbox={false}
                        />
                    )}
                    <div className="latest-page__article-content">
                        <h2 className="latest-page__article-title">
                            {hit.title}
                        </h2>
                        <p className="latest-page__article-excerpt">
                            {hit.excerpt}
                        </p>
                        <p className="latest-page__article-authors">
                            {formatAuthors(hit.authors)}
                        </p>
                    </div>
                </a>
            </article>
        </AttachmentsContext.Provider>
    )
}

const LatestDataInsightCard = ({ hit }: { hit: PageChronologicalRecord }) => {
    const href = getPrefixedGdocPath("", {
        slug: hit.slug,
        content: { type: OwidGdocType.DataInsight },
    })
    const body = hit.body ?? []
    const firstImage = body.find((block) => block.type === "image")
    const otherBlocks = body.filter((block) => block !== firstImage)

    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                className={cx("latest-page__data-insight", COMMON_CLASSES)}
            >
                <DataInsightDateline
                    publishedAt={new Date(hit.date)}
                    className="latest-page__item-dateline h6-black-caps span-cols-4"
                />
                <p className="latest-page__item-type h6-black-caps span-cols-4 col-start-5">
                    Data Insight
                </p>
                <a
                    href={href}
                    aria-label={hit.title}
                    className="latest-page__data-insight-link span-cols-8"
                >
                    {firstImage && (
                        <Image
                            className="latest-page__data-insight-image"
                            filename={firstImage.filename}
                            containerType="span-5"
                            shouldLightbox={false}
                        />
                    )}
                    <div className="latest-page__data-insight-content">
                        <h2 className="latest-page__data-insight-title body-1-bold">
                            {hit.title}
                        </h2>
                        <div className="latest-page__data-insight-blocks">
                            <ArticleBlocks
                                blocks={otherBlocks}
                                shouldRenderLinks={false}
                            />
                        </div>
                    </div>
                </a>
            </article>
        </AttachmentsContext.Provider>
    )
}

const ANNOUNCEMENT_THUMBNAILS: Record<string, string> = {
    "Data update": "/data-update-thumbnail.png",
    "Website upgrade": "/website-upgrade-thumbnail.png",
    Announcement: "/announcement-thumbnail.png",
}

const LatestAnnouncementCard = ({ hit }: { hit: PageChronologicalRecord }) => {
    const kicker = hit.announcementContent?.kicker ?? "Announcement"
    const thumbnail =
        ANNOUNCEMENT_THUMBNAILS[kicker] ?? ANNOUNCEMENT_THUMBNAILS.Announcement
    const body = hit.announcementContent?.body ?? []
    const cta = hit.announcementContent?.cta
    const hasCta = cta && cta.url && cta.text

    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                className={cx("latest-page__announcement", COMMON_CLASSES)}
            >
                <DataInsightDateline
                    publishedAt={new Date(hit.date)}
                    className="latest-page__item-dateline h6-black-caps span-cols-4"
                />
                <span className="latest-page__announcement-kicker h6-black-caps span-cols-4 col-start-5">
                    {kicker}
                </span>
                <div className="latest-page__announcement-card grid grid-cols-8 span-cols-8">
                    <img
                        src={thumbnail}
                        alt=""
                        className="latest-page__announcement-thumbnail span-cols-2 span-sm-cols-8"
                    />
                    <div className="latest-page__announcement-content span-cols-6 span-sm-cols-8">
                        <h2 className="latest-page__announcement-title subtitle-2-bold">
                            {hit.title}
                        </h2>
                        {hit.authors.length > 0 && (
                            <div className="latest-page__announcement-authors data-insight-authors body-3-medium">
                                {hit.authors.map((author, index) => (
                                    <LinkedAuthorComponent
                                        className="data-insight-author"
                                        key={index}
                                        name={author}
                                        includeImage={true}
                                    />
                                ))}
                            </div>
                        )}
                        <ExpandableParagraph
                            className="latest-page__announcement-body"
                            buttonVariant="slim"
                        >
                            {hasCta ? (
                                <>
                                    <p>{hit.excerpt}</p>
                                    <Cta
                                        shouldRenderLinks
                                        text={cta.text}
                                        url={cta.url}
                                    />
                                </>
                            ) : (
                                <ArticleBlocks
                                    blocks={body}
                                    interactiveImages={false}
                                />
                            )}
                        </ExpandableParagraph>
                    </div>
                </div>
            </article>
        </AttachmentsContext.Provider>
    )
}

export const LatestResultCard = ({ hit }: { hit: PageChronologicalRecord }) => {
    switch (hit.type) {
        case OwidGdocType.Article:
            return <LatestArticleCard hit={hit} />
        case OwidGdocType.DataInsight:
            return <LatestDataInsightCard hit={hit} />
        case OwidGdocType.Announcement:
            return <LatestAnnouncementCard hit={hit} />
        default:
            return null
    }
}
