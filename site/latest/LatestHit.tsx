import { OwidGdocType } from "@ourworldindata/utils"
import { PageChronologicalRecord } from "@ourworldindata/types"
import { LatestArticleHit } from "./LatestArticleHit.js"
import { LatestDataInsightHit } from "./LatestDataInsightHit.js"
import { LatestAnnouncementHit } from "./LatestAnnouncementHit.js"
import { match } from "ts-pattern"

type LatestHitProps = {
    hit: PageChronologicalRecord
    selectedTopic?: string
    position: number
    shouldAutoExpand: boolean
    /** Render the card's full body rather than the clipped preview. Set by
     * LatestSearch when the feed is filtered to this card's own type. */
    isExpanded?: boolean
}

/** Dispatches to the appropriate per-type hit card. */
export const LatestHit = ({
    hit,
    selectedTopic,
    position,
    shouldAutoExpand,
    isExpanded,
}: LatestHitProps) => {
    return match(hit)
        .with({ type: OwidGdocType.Article }, (hit) => (
            <LatestArticleHit
                hit={hit}
                selectedTopic={selectedTopic}
                position={position}
            />
        ))
        .with({ type: OwidGdocType.DataInsight }, (hit) => (
            <LatestDataInsightHit
                hit={hit}
                selectedTopic={selectedTopic}
                position={position}
                isExpanded={isExpanded}
            />
        ))
        .with({ type: OwidGdocType.Announcement }, (hit) => (
            <LatestAnnouncementHit
                hit={hit}
                selectedTopic={selectedTopic}
                position={position}
                shouldAutoExpand={shouldAutoExpand}
                isExpanded={isExpanded}
            />
        ))
        .with(
            { type: OwidGdocType.TopicPage },
            { type: OwidGdocType.LinearTopicPage },
            () => null
        )
        .exhaustive()
}
