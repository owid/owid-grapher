import { PageChronologicalRecord } from "@ourworldindata/types"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import LinkedAuthorComponent from "../gdocs/components/LinkedAuthor.js"
import { Cta } from "../gdocs/components/Cta.js"
import { ExpandableText } from "./ExpandableText.js"
import cx from "classnames"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import { LATEST_HIT_GRID_CLASSES, makeAttachments } from "./latestUtils.js"

export const LatestAnnouncementHit = ({
    hit,
    selectedTopic,
}: {
    hit: PageChronologicalRecord
    selectedTopic?: string
}) => {
    const cta = hit.announcementContent?.cta
    const hasCta = !!(cta && cta.url && cta.text)
    const body = hit.announcementContent?.body ?? []

    const authorByline = hit.authors.length > 0 && (
        <div className="latest-announcement-hit__authors data-insight-authors body-3-medium">
            {hit.authors.map((author, index) => (
                <LinkedAuthorComponent
                    className="data-insight-author"
                    key={index}
                    name={author}
                    includeImage={true}
                />
            ))}
        </div>
    )

    const titleId = `latest-hit-${hit.slug}-title`

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
                <LatestHitMetadata hit={hit} selectedTopic={selectedTopic} />
                <div className="latest-announcement-hit__card">
                    <h2
                        id={titleId}
                        className="latest-announcement-hit__title subtitle-2-bold"
                    >
                        {hit.title}
                    </h2>
                    {/* Body and {.cta} are mutually exclusive — see
                        GdocAnnouncement._validateSubclass. We mirror
                        AnnouncementPageContent's branching so the feed
                        card matches what editors preview on the
                        standalone page. */}
                    {hasCta ? (
                        <>
                            {authorByline}
                            <p className="latest-announcement-hit__excerpt">
                                {hit.excerpt}
                            </p>
                            <Cta
                                shouldRenderLinks
                                text={cta.text}
                                url={cta.url}
                            />
                        </>
                    ) : (
                        <ExpandableText
                            blocks={body}
                            containerType="latest-announcement"
                        >
                            {authorByline}
                        </ExpandableText>
                    )}
                </div>
            </article>
        </AttachmentsContext.Provider>
    )
}
