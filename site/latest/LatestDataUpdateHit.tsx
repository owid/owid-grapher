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

/** Compact cards link to the announcement page. Expanded cards render the
 * full update with independent body and author links — and so, being that
 * page's content rather than a link to it, don't wait on its bake. */
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
    const isLikelyBaked = useIsLikelyBaked(hit)
    const firstImage = findThumbnailImageBlock(hit.body)
    const otherBlocks = hit.body.filter((block) => block !== firstImage)
    const titleId = `latest-hit-${hit.slug}-title`
    const Card = isExpanded ? "div" : "a"

    // Only the compact card's destination depends on this publish's bake.
    if (!isExpanded && !isLikelyBaked) return null

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
                <Card
                    href={isExpanded ? undefined : announcementHref}
                    aria-labelledby={isExpanded ? undefined : titleId}
                    onClick={
                        isExpanded
                            ? undefined
                            : () =>
                                  analytics.logLatestResultClick(hit, position)
                    }
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
                            {...firstImage}
                            className="latest-data-update-hit__image span-cols-3"
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
                            {hit.title}
                        </h2>
                        <p className="latest-data-update-hit__authors">
                            {formatAuthors(hit.authors)}
                        </p>
                        <div className="latest-data-update-hit__blocks">
                            <ArticleBlocks
                                blocks={otherBlocks}
                                shouldRenderLinks={isExpanded}
                                interactiveImages={isExpanded}
                            />
                        </div>
                    </div>
                </Card>
            </article>
        </AttachmentsContext.Provider>
    )
}
