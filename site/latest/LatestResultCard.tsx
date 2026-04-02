import * as React from "react"
import { formatAuthors, OwidGdocType } from "@ourworldindata/utils"
import {
    ImageMetadata,
    OwidEnrichedGdocBlock,
    PageChronologicalRecord,
} from "@ourworldindata/types"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import Image from "../gdocs/components/Image.js"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"
import DataInsightDateline from "../gdocs/components/DataInsightDateline.js"
import LinkedAuthorComponent from "../gdocs/components/LinkedAuthor.js"
import { Cta } from "../gdocs/components/Cta.js"
import { ExpandableParagraph } from "../blocks/ExpandableParagraph.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faChartLine,
    faArrowPointer,
    faNewspaper,
} from "@fortawesome/free-solid-svg-icons"
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import cx from "classnames"

const COMMON_CLASSES =
    "grid grid-cols-8 span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"

/** Content type labels for Articles and Data Insights (shown on the left). */
const TYPE_LABELS: Partial<Record<string, string>> = {
    [OwidGdocType.Article]: "Article",
    [OwidGdocType.DataInsight]: "Data Insight",
}

/** Icons shown before the title for each announcement kicker type. */
const KICKER_ICONS: Record<string, IconDefinition> = {
    "Data update": faChartLine,
    "Website upgrade": faArrowPointer,
    Announcement: faNewspaper,
}

/**
 * Metadata row shown above each card: content type + #area on the left,
 * date on the right. Announcements / Data Updates / Website Upgrades don't
 * show a content type label (it's embedded in the title instead).
 */
const CardMetadataRow = ({
    hit,
    onTopicClick,
    selectedTopic,
}: {
    hit: PageChronologicalRecord
    onTopicClick?: (topic: string) => void
    selectedTopic?: string
}) => {
    const typeLabel = TYPE_LABELS[hit.type]
    const firstTag =
        selectedTopic && hit.tags?.includes(selectedTopic)
            ? selectedTopic
            : hit.tags?.[0]
    return (
        <div className="latest-page__item-meta span-cols-8">
            <span className="latest-page__item-meta-left h6-black-caps">
                {typeLabel && (
                    <span className="latest-page__item-type-label">
                        {typeLabel}
                    </span>
                )}
                {typeLabel && firstTag && (
                    <span className="latest-page__item-meta-separator">—</span>
                )}
                {firstTag && (
                    <span className="latest-page__item-area-tag">
                        {firstTag}
                    </span>
                )}
            </span>
            <DataInsightDateline
                publishedAt={new Date(hit.date)}
                className="latest-page__item-dateline h6-black-caps"
            />
        </div>
    )
}

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

const LatestArticleCard = ({
    hit,
    onTopicClick,
    selectedTopic,
}: {
    hit: PageChronologicalRecord
    onTopicClick?: (topic: string) => void
    selectedTopic?: string
}) => {
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
                <CardMetadataRow
                    hit={hit}
                    onTopicClick={onTopicClick}
                    selectedTopic={selectedTopic}
                />
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

const LatestDataInsightCard = ({
    hit,
    onTopicClick,
    selectedTopic,
}: {
    hit: PageChronologicalRecord
    onTopicClick?: (topic: string) => void
    selectedTopic?: string
}) => {
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
                <CardMetadataRow
                    hit={hit}
                    onTopicClick={onTopicClick}
                    selectedTopic={selectedTopic}
                />
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

const MEDIA_BLOCK_TYPES = new Set(["image", "cta"])

/**
 * Split body blocks before the first image or CTA block. The author
 * byline is rendered between the two groups.
 */
function splitBodyBeforeMedia(blocks: OwidEnrichedGdocBlock[]): {
    textBlocks: OwidEnrichedGdocBlock[]
    trailingBlocks: OwidEnrichedGdocBlock[]
} {
    const firstMediaIndex = blocks.findIndex((b) =>
        MEDIA_BLOCK_TYPES.has(b.type)
    )
    if (firstMediaIndex === -1) {
        return { textBlocks: blocks, trailingBlocks: [] }
    }
    return {
        textBlocks: blocks.slice(0, firstMediaIndex),
        trailingBlocks: blocks.slice(firstMediaIndex),
    }
}

const LatestAnnouncementCard = ({
    hit,
    onTopicClick,
    selectedTopic,
}: {
    hit: PageChronologicalRecord
    onTopicClick?: (topic: string) => void
    selectedTopic?: string
}) => {
    const kicker = hit.announcementContent?.kicker ?? hit.kicker
    const kickerIcon = kicker ? KICKER_ICONS[kicker] : undefined
    const body = hit.announcementContent?.body ?? []
    const cta = hit.announcementContent?.cta
    const hasCta = cta && cta.url && cta.text
    const { textBlocks, trailingBlocks } = splitBodyBeforeMedia(body)

    const authorByline = hit.authors.length > 0 && (
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
    )

    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                className={cx("latest-page__announcement", COMMON_CLASSES)}
            >
                <CardMetadataRow
                    hit={hit}
                    onTopicClick={onTopicClick}
                    selectedTopic={selectedTopic}
                />
                <div className="latest-page__announcement-content span-cols-8">
                    <h2 className="latest-page__announcement-title subtitle-2-bold">
                        {kickerIcon && (
                            <FontAwesomeIcon
                                icon={kickerIcon}
                                className="latest-page__announcement-title-icon"
                            />
                        )}
                        {kicker && `${kicker}: `}
                        {hit.title}
                    </h2>
                    <ExpandableParagraph
                        className="latest-page__announcement-body"
                        buttonVariant="slim"
                    >
                        {hasCta ? (
                            <>
                                <p>{hit.excerpt}</p>
                                {authorByline}
                                <Cta
                                    shouldRenderLinks
                                    text={cta.text}
                                    url={cta.url}
                                />
                            </>
                        ) : (
                            <>
                                <ArticleBlocks
                                    blocks={textBlocks}
                                    interactiveImages={false}
                                />
                                {authorByline}
                                <ArticleBlocks
                                    blocks={trailingBlocks}
                                    interactiveImages={false}
                                />
                            </>
                        )}
                    </ExpandableParagraph>
                </div>
            </article>
        </AttachmentsContext.Provider>
    )
}

export const LatestResultCard = ({
    hit,
    onTopicClick,
    selectedTopic,
}: {
    hit: PageChronologicalRecord
    onTopicClick?: (topic: string) => void
    selectedTopic?: string
}) => {
    switch (hit.type) {
        case OwidGdocType.Article:
            return (
                <LatestArticleCard
                    hit={hit}
                    onTopicClick={onTopicClick}
                    selectedTopic={selectedTopic}
                />
            )
        case OwidGdocType.DataInsight:
            return (
                <LatestDataInsightCard
                    hit={hit}
                    onTopicClick={onTopicClick}
                    selectedTopic={selectedTopic}
                />
            )
        case OwidGdocType.Announcement:
            return (
                <LatestAnnouncementCard
                    hit={hit}
                    onTopicClick={onTopicClick}
                    selectedTopic={selectedTopic}
                />
            )
        default:
            return null
    }
}
