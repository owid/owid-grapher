import { PageChronologicalAnnouncementRecord } from "@ourworldindata/types"
import cx from "clsx"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import { AnnouncementContent } from "./AnnouncementContent.js"
import {
    LATEST_HIT_GRID_CLASSES,
    announcementContentTitleId,
    makeAttachments,
} from "./latestUtils.js"
import { useLatestContext } from "./LatestContext.js"

export const LatestAnnouncementHit = ({
    hit,
    selectedTopic,
    position,
    shouldAutoExpand,
}: {
    hit: PageChronologicalAnnouncementRecord
    selectedTopic?: string
    position: number
    shouldAutoExpand: boolean
}) => {
    const { analytics } = useLatestContext()
    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                aria-labelledby={announcementContentTitleId(hit.slug)}
                className={cx(
                    "latest-announcement-hit",
                    LATEST_HIT_GRID_CLASSES
                )}
            >
                <AnnouncementContent
                    title={hit.title}
                    latestType={hit.latestType}
                    tags={hit.tags ?? []}
                    slug={hit.slug}
                    publishedAt={hit.date}
                    authors={hit.authors}
                    excerpt={hit.excerpt}
                    body={hit.body}
                    cta={hit.cta}
                    selectedTopic={selectedTopic}
                    onReadMore={() =>
                        analytics.logLatestAnnouncementExpand(hit, position)
                    }
                    shouldAutoExpand={shouldAutoExpand}
                />
            </article>
        </AttachmentsContext.Provider>
    )
}
