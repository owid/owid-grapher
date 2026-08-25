import { OwidGdocType } from "@ourworldindata/utils"
import { PageChronologicalDataInsightRecord } from "@ourworldindata/types"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import cx from "clsx"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import { LatestFeedCard } from "./LatestFeedCard.js"
import { LatestDataInsightExpandedCard } from "./LatestDataInsightExpandedCard.js"
import {
    LATEST_EXPANDED_DATA_INSIGHT_GRID_CLASSES,
    LATEST_HIT_GRID_CLASSES,
    makeAttachments,
    splitOutFeedCardMedia,
} from "./latestUtils.js"
import { useLatestContext } from "./LatestContext.js"
import { useIsLikelyBaked } from "./latestHooks.js"

export const LatestDataInsightHit = ({
    hit,
    selectedTopic,
    position,
    isExpanded,
}: {
    hit: PageChronologicalDataInsightRecord
    selectedTopic?: string
    position: number
    isExpanded?: boolean
}) => {
    const { analytics } = useLatestContext()
    const href = getPrefixedGdocPath("", {
        slug: hit.slug,
        content: { type: OwidGdocType.DataInsight },
    })
    const isLikelyBaked = useIsLikelyBaked(href, hit.date)
    const { media, bodyBlocks } = splitOutFeedCardMedia(hit.body)
    const titleId = `latest-hit-${hit.slug}-title`
    const onClick = () => analytics.logLatestResultClick(hit, position)

    if (!isLikelyBaked) return null

    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                className={cx(
                    "latest-data-insight-hit",
                    isExpanded
                        ? LATEST_EXPANDED_DATA_INSIGHT_GRID_CLASSES
                        : LATEST_HIT_GRID_CLASSES
                )}
            >
                <LatestHitMetadata
                    latestType={hit.latestType}
                    tags={hit.tags}
                    publishedAt={hit.date}
                    selectedTopic={selectedTopic}
                />
                {isExpanded ? (
                    // The body renders whole and in its authored order, rather
                    // than with the figure split out into the card's own
                    // column — that block order is what the detail page shows.
                    <LatestDataInsightExpandedCard
                        href={href}
                        title={hit.title}
                        titleId={titleId}
                        authors={hit.authors}
                        blocks={hit.body}
                        onClick={onClick}
                    />
                ) : (
                    <LatestFeedCard
                        href={href}
                        title={hit.title}
                        titleId={titleId}
                        authors={hit.authors}
                        media={media}
                        blocks={bodyBlocks}
                        onClick={onClick}
                    />
                )}
            </article>
        </AttachmentsContext.Provider>
    )
}
