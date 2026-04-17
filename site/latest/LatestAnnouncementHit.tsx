import { PageChronologicalRecord } from "@ourworldindata/types"
import cx from "classnames"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import { AnnouncementContent } from "./AnnouncementContent.js"
import {
    LATEST_HIT_GRID_CLASSES,
    announcementContentTitleId,
    makeAttachments,
} from "./latestUtils.js"

export const LatestAnnouncementHit = ({
    hit,
    selectedTopic,
}: {
    hit: PageChronologicalRecord
    selectedTopic?: string
}) => {
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
                    body={hit.body ?? []}
                    cta={hit.cta}
                    selectedTopic={selectedTopic}
                />
            </article>
        </AttachmentsContext.Provider>
    )
}
