import { formatAuthors, OwidGdocType } from "@ourworldindata/utils"
import { PageChronologicalAnnouncementRecord } from "@ourworldindata/types"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import cx from "clsx"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import Image from "../gdocs/components/Image.js"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import {
    LATEST_HIT_GRID_CLASSES,
    findThumbnailImageBlock,
    makeAttachments,
} from "./latestUtils.js"
import { useLatestContext } from "./LatestContext.js"
import { useIsLikelyBaked } from "./latestHooks.js"

/**
 * Data update card for the /latest feed.
 *
 * Two states, driven by `isExpanded`, which is set whenever we know the
 * reader came looking for data updates specifically — either the
 * `?type=data-update` filter is on, or they followed a link straight to this
 * card. Expanded, the whole update is readable in place, with navigation
 * through its body links and CTA. The card itself is inert.
 * Collapsed, the body is clipped under a fade and its links are inert text;
 * a stretched title link makes the whole card lead to the announcement page.
 */
export const LatestDataUpdateHit = ({
    hit,
    selectedTopic,
    position,
    isExpanded,
}: {
    hit: PageChronologicalAnnouncementRecord
    selectedTopic?: string
    position: number
    isExpanded: boolean
}) => {
    const { analytics } = useLatestContext()
    const announcementHref = getPrefixedGdocPath("", {
        slug: hit.slug,
        content: { type: OwidGdocType.Announcement },
    })
    const isLikelyBaked = useIsLikelyBaked(announcementHref, hit.date)
    const firstImage = findThumbnailImageBlock(hit.body)
    const otherBlocks = hit.body.filter((block) => block !== firstImage)
    const titleId = `latest-hit-${hit.slug}-title`

    if (!isLikelyBaked) return null

    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                aria-labelledby={titleId}
                className={cx(
                    "latest-data-update-hit",
                    LATEST_HIT_GRID_CLASSES
                )}
            >
                <LatestHitMetadata
                    latestType={hit.latestType}
                    tags={hit.tags}
                    publishedAt={hit.date}
                    selectedTopic={selectedTopic}
                />
                <div
                    className={cx(
                        "latest-data-update-hit__card grid grid-cols-8",
                        {
                            "latest-data-update-hit__card--collapsed":
                                !isExpanded,
                        }
                    )}
                >
                    {firstImage && (
                        <Image
                            className="latest-data-update-hit__image span-cols-3"
                            filename={firstImage.filename}
                            containerType="latest-article"
                            shouldLightbox={false}
                        />
                    )}
                    <div
                        className={cx(
                            "latest-data-update-hit__content span-cols-5",
                            {
                                "latest-data-update-hit__content--collapsed":
                                    !isExpanded,
                            }
                        )}
                    >
                        <h2
                            id={titleId}
                            className="latest-data-update-hit__title body-1-bold"
                        >
                            {isExpanded ? (
                                hit.title
                            ) : (
                                <a
                                    href={announcementHref}
                                    className="latest-data-update-hit__title-link"
                                    onClick={() =>
                                        analytics.logLatestResultClick(
                                            hit,
                                            position
                                        )
                                    }
                                >
                                    {hit.title}
                                </a>
                            )}
                        </h2>
                        <p className="latest-data-update-hit__authors">
                            {formatAuthors(hit.authors)}
                        </p>
                        <div className="latest-data-update-hit__blocks">
                            <ArticleBlocks
                                blocks={otherBlocks}
                                shouldRenderLinks={isExpanded}
                            />
                        </div>
                    </div>
                </div>
            </article>
        </AttachmentsContext.Provider>
    )
}
