import { OwidGdocType } from "@ourworldindata/utils"
import { PageChronologicalRecord } from "@ourworldindata/types"
import DataInsightDateline from "../gdocs/components/DataInsightDateline.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowPointer,
    faBook,
    faChartLine,
    faLightbulb,
    faNewspaper,
} from "@fortawesome/free-solid-svg-icons"
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"

/** Content type labels and icons for the metadata row. */
const TYPE_META: Record<string, { label: string; icon: IconDefinition }> = {
    [OwidGdocType.Article]: { label: "Article", icon: faBook },
    [OwidGdocType.DataInsight]: { label: "Data Insight", icon: faLightbulb },
}

/** Announcement kicker labels and icons for the metadata row. */
const KICKER_META: Record<string, { label: string; icon: IconDefinition }> = {
    "data-update": { label: "Data Update", icon: faChartLine },
    "website-upgrade": { label: "Website Upgrade", icon: faArrowPointer },
    announcement: { label: "Announcement", icon: faNewspaper },
}

/**
 * Metadata row shown above each card: icon + type label + #area on the left,
 * date on the right.
 */
export const LatestHitMetadata = ({
    hit,
    selectedTopic,
}: {
    hit: PageChronologicalRecord
    selectedTopic?: string
}) => {
    const kicker =
        hit.type === OwidGdocType.Announcement ? hit.kicker : undefined
    const meta = kicker ? KICKER_META[kicker] : TYPE_META[hit.type]
    const firstTag =
        selectedTopic && hit.tags?.includes(selectedTopic)
            ? selectedTopic
            : hit.tags?.[0]
    return (
        <div className="latest-hit-metadata">
            <span className="latest-hit-metadata__left h6-black-caps">
                {meta && (
                    <span className="latest-hit-metadata__type-label">
                        <FontAwesomeIcon
                            icon={meta.icon}
                            className="latest-hit-metadata__type-icon"
                        />
                        {meta.label}
                    </span>
                )}
                {meta && firstTag && (
                    <span className="latest-hit-metadata__separator">—</span>
                )}
                {firstTag && (
                    <span className="latest-hit-metadata__area-tag">
                        {firstTag}
                    </span>
                )}
            </span>
            <DataInsightDateline
                publishedAt={new Date(hit.date)}
                className="latest-hit-metadata__dateline h6-black-caps"
            />
        </div>
    )
}
