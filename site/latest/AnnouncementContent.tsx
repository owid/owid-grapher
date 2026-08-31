import { LatestType, OwidEnrichedGdocBlock } from "@ourworldindata/types"
import LinkedAuthor from "../gdocs/components/LinkedAuthor.js"
import { ExpandableText } from "./ExpandableText.js"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import { announcementContentTitleId } from "./latestUtils.js"

/** Inner content of an announcement card in the /latest feed
 * (Algolia-backed). Always needs a wrapper that supplies the
 * AttachmentsContext and surrounding chrome — it is not a standalone
 * component on its own. <ExpandableText> truncates with a Read more toggle
 * unless isExpanded says the reader came looking for this kind of
 * announcement specifically. The standalone announcement page is a different
 * component (gdocs/pages/Announcement.tsx), built like the data insight
 * page. */
export const AnnouncementContent = ({
    title,
    latestType,
    tags,
    slug,
    publishedAt,
    authors,
    body,
    isExpanded,
    selectedTopic,
    onReadMore,
}: {
    title: string
    latestType?: LatestType
    tags: string[]
    slug: string
    publishedAt: Date | string | null
    authors: string[]
    body: OwidEnrichedGdocBlock[]
    isExpanded?: boolean
    selectedTopic?: string
    onReadMore?: () => void
}) => {
    const titleId = announcementContentTitleId(slug)

    const authorByline = authors.length > 0 && (
        <div className="announcement-content__authors body-3-medium">
            {authors.map((author, index) => (
                <LinkedAuthor
                    className="announcement-content__author"
                    key={index}
                    name={author}
                    includeImage={true}
                />
            ))}
        </div>
    )

    return (
        <div className="announcement-content">
            <LatestHitMetadata
                latestType={latestType}
                tags={tags}
                publishedAt={publishedAt}
                selectedTopic={selectedTopic}
            />
            <h2
                id={titleId}
                className="announcement-content__title subtitle-2-bold"
            >
                {title}
            </h2>
            <ExpandableText
                blocks={body}
                containerType="latest-announcement"
                alwaysExpanded={isExpanded}
                onReadMore={onReadMore}
            >
                {authorByline}
            </ExpandableText>
        </div>
    )
}
