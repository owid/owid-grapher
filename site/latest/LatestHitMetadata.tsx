import { LATEST_TYPE_LABELS, LatestType } from "@ourworldindata/types"
import DataInsightDateline from "../gdocs/components/DataInsightDateline.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowPointer,
    faBook,
    faBookmark,
    faChartLine,
    faEnvelope,
    faLightbulb,
    faNewspaper,
} from "@fortawesome/free-solid-svg-icons"
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"

/** Icons shown in the metadata row, keyed by latestType. Labels live in
 * LATEST_TYPE_LABELS so other render sites (announcement page, homepage)
 * share the same wording. */
const LATEST_TYPE_ICONS: Record<LatestType, IconDefinition> = {
    article: faBook,
    "data-insight": faLightbulb,
    "data-update": faChartLine,
    "topic-update": faBookmark,
    "website-upgrade": faArrowPointer,
    announcement: faNewspaper,
    newsletter: faEnvelope,
}

/**
 * Metadata row shown above each card: icon + type label + #area on the left,
 * date on the right. Takes primitives so both Algolia-backed feed hits
 * (which carry an ISO date string) and the gdoc-backed standalone
 * announcement page (which has a Date) can pass through without converting.
 */
export const LatestHitMetadata = ({
    latestType,
    tags,
    publishedAt,
    selectedTopic,
}: {
    latestType?: LatestType
    tags?: string[]
    publishedAt: Date | string | null
    selectedTopic?: string
}) => {
    const firstTag =
        selectedTopic && tags?.includes(selectedTopic)
            ? selectedTopic
            : tags?.[0]
    const date =
        typeof publishedAt === "string" ? new Date(publishedAt) : publishedAt
    return (
        <div className="latest-hit-metadata">
            <span className="latest-hit-metadata__left h6-black-caps">
                {latestType && (
                    <span className="latest-hit-metadata__type-label">
                        <FontAwesomeIcon
                            icon={LATEST_TYPE_ICONS[latestType]}
                            className="latest-hit-metadata__type-icon"
                        />
                        {LATEST_TYPE_LABELS[latestType]}
                    </span>
                )}
                {latestType && firstTag && (
                    <span className="latest-hit-metadata__separator">—</span>
                )}
                {firstTag && (
                    <span className="latest-hit-metadata__area-tag">
                        {firstTag}
                    </span>
                )}
            </span>
            <DataInsightDateline
                publishedAt={date}
                className="latest-hit-metadata__dateline h6-black-caps"
            />
        </div>
    )
}
