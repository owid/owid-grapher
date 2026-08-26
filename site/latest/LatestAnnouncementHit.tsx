import { PageChronologicalAnnouncementRecord } from "@ourworldindata/types"
import { OwidGdocType } from "@ourworldindata/utils"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import cx from "clsx"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import { AnnouncementContent } from "./AnnouncementContent.js"
import { LatestFeedCard } from "./LatestFeedCard.js"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import {
    LATEST_HIT_GRID_CLASSES,
    announcementContentTitleId,
    makeAttachments,
    splitOutFeedCardMedia,
} from "./latestUtils.js"
import { useLatestContext } from "./LatestContext.js"
import { useIsLikelyBaked } from "./latestHooks.js"

export const LatestAnnouncementHit = ({
    hit,
    selectedTopic,
    position,
    shouldAutoExpand,
    isExpanded,
}: {
    hit: PageChronologicalAnnouncementRecord
    selectedTopic?: string
    position: number
    shouldAutoExpand: boolean
    isExpanded?: boolean
}) => {
    const { analytics } = useLatestContext()
    const href = getPrefixedGdocPath("", {
        slug: hit.slug,
        content: { type: OwidGdocType.Announcement },
    })
    const isLikelyBaked = useIsLikelyBaked(href, hit.date)
    const titleId = announcementContentTitleId(hit.slug)

    // Only data updates get the shared feed-card treatment (thumbnail left,
    // text right, clickable through to the announcement's own page). The other
    // announcement kinds — topic updates, website upgrades, general
    // announcements — stay on the inline "Read more" rendering, as does any
    // announcement with an empty body, which has no card content to show.
    const shouldUseFeedCard =
        hit.latestType === "data-update" && hit.body.length > 0

    const { media, bodyBlocks } = splitOutFeedCardMedia(hit.body)

    if (shouldUseFeedCard && !isLikelyBaked) return null

    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                aria-labelledby={titleId}
                className={cx(
                    "latest-announcement-hit",
                    LATEST_HIT_GRID_CLASSES
                )}
            >
                {shouldUseFeedCard ? (
                    <>
                        <LatestHitMetadata
                            latestType={hit.latestType}
                            tags={hit.tags ?? []}
                            publishedAt={hit.date}
                            selectedTopic={selectedTopic}
                        />
                        <LatestFeedCard
                            href={href}
                            title={hit.title}
                            titleId={titleId}
                            authors={hit.authors}
                            media={media}
                            blocks={bodyBlocks}
                            isExpanded={isExpanded}
                            onClick={() =>
                                analytics.logLatestResultClick(hit, position)
                            }
                        />
                    </>
                ) : (
                    <AnnouncementContent
                        title={hit.title}
                        latestType={hit.latestType}
                        tags={hit.tags ?? []}
                        slug={hit.slug}
                        publishedAt={hit.date}
                        authors={hit.authors}
                        body={hit.body}
                        selectedTopic={selectedTopic}
                        onReadMore={() =>
                            analytics.logLatestAnnouncementExpand(hit, position)
                        }
                        shouldAutoExpand={shouldAutoExpand}
                    />
                )}
            </article>
        </AttachmentsContext.Provider>
    )
}
