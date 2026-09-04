import { OwidGdocType } from "@ourworldindata/utils"
import { PageChronologicalRecord } from "@ourworldindata/types"
import { LatestArticleHit } from "./LatestArticleHit.js"
import { LatestDataInsightHit } from "./LatestDataInsightHit.js"
import { LatestAnnouncementHit } from "./LatestAnnouncementHit.js"
import { LatestDataUpdateHit } from "./LatestDataUpdateHit.js"
import { match } from "ts-pattern"

type LatestHitProps = {
    hit: PageChronologicalRecord
    selectedTopic?: string
    position: number
    isExpanded: boolean
}

/** Dispatches to the appropriate per-type hit card. */
export const LatestHit = ({
    hit,
    selectedTopic,
    position,
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
            />
        ))
        .with(
            { type: OwidGdocType.Announcement, latestType: "data-update" },
            (hit) => (
                <LatestDataUpdateHit
                    hit={hit}
                    selectedTopic={selectedTopic}
                    position={position}
                    isExpanded={isExpanded}
                />
            )
        )
        .with({ type: OwidGdocType.Announcement }, (hit) => (
            <LatestAnnouncementHit
                hit={hit}
                selectedTopic={selectedTopic}
                position={position}
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
