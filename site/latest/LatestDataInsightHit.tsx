import { OwidGdocType } from "@ourworldindata/utils"
import { PageChronologicalDataInsightRecord } from "@ourworldindata/types"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import cx from "clsx"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import { LatestFeedCard } from "./LatestFeedCard.js"
import {
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

    if (!isLikelyBaked) return null

    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                className={cx(
                    "latest-data-insight-hit",
                    LATEST_HIT_GRID_CLASSES
                )}
            >
                <LatestHitMetadata
                    latestType={hit.latestType}
                    tags={hit.tags}
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
            </article>
        </AttachmentsContext.Provider>
    )
}
