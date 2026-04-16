import { OwidGdocType } from "@ourworldindata/utils"
import { PageChronologicalRecord } from "@ourworldindata/types"
import { LatestArticleHit } from "./LatestArticleHit.js"
import { LatestDataInsightHit } from "./LatestDataInsightHit.js"
import { LatestAnnouncementHit } from "./LatestAnnouncementHit.js"

type LatestHitProps = {
    hit: PageChronologicalRecord
    selectedTopic?: string
}

const HIT_COMPONENTS: Partial<Record<OwidGdocType, React.FC<LatestHitProps>>> =
    {
        [OwidGdocType.Article]: LatestArticleHit,
        [OwidGdocType.DataInsight]: LatestDataInsightHit,
        [OwidGdocType.Announcement]: LatestAnnouncementHit,
    }

/** Dispatches to the appropriate per-type hit card. */
export const LatestHit = ({ hit, selectedTopic }: LatestHitProps) => {
    const Component = HIT_COMPONENTS[hit.type as OwidGdocType]
    return Component ? (
        <Component hit={hit} selectedTopic={selectedTopic} />
    ) : null
}
