import { LatestType, OwidEnrichedGdocBlock } from "@ourworldindata/types"
import cx from "classnames"
import LinkedAuthor from "../gdocs/components/LinkedAuthor.js"
import { Cta } from "../gdocs/components/Cta.js"
import { ExpandableText } from "./ExpandableText.js"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import { announcementContentTitleId } from "./latestUtils.js"

/** Shared inner content of an announcement, used by both /latest feed hits
 * (Algolia-backed) and the standalone preview page (gdoc-backed). Always
 * needs a wrapper that supplies the AttachmentsContext and surrounding
 * chrome — it is not a standalone component on its own. The two call sites
 * differ only in heading level (h1 vs h2) and whether <ExpandableText>
 * truncates with a Read more toggle (feed) or renders fully (standalone via
 * alwaysExpanded). The standalone version passes alwaysExpanded rather than
 * bypassing <ExpandableText>, so the DOM and grid layout stay identical to
 * the feed and editors previewing an announcement see what readers will see
 * in the feed. */
export const AnnouncementContent = ({
    title,
    latestType,
    tags,
    slug,
    publishedAt,
    authors,
    excerpt,
    body,
    cta,
    isStandalone,
    selectedTopic,
    onReadMore,
}: {
    title: string
    latestType?: LatestType
    tags: string[]
    slug: string
    publishedAt: Date | string | null
    authors: string[]
    excerpt: string
    body: OwidEnrichedGdocBlock[]
    cta?: { text: string; url: string }
    /** When rendered as the standalone preview page: use h1, show full body
     * (no Read more truncation). */
    isStandalone?: boolean
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

    const Heading = isStandalone ? "h1" : "h2"

    return (
        <div
            className={cx("announcement-content", {
                "announcement-content--standalone": isStandalone,
            })}
        >
            <LatestHitMetadata
                latestType={latestType}
                tags={tags}
                publishedAt={publishedAt}
                selectedTopic={selectedTopic}
            />
            <Heading
                id={titleId}
                className="announcement-content__title subtitle-2-bold"
            >
                {title}
            </Heading>
            {/* Body and {.cta} are mutually exclusive — see
                GdocAnnouncement._validateSubclass. */}
            {cta && cta.url && cta.text ? (
                <>
                    {authorByline}
                    <p className="announcement-content__excerpt">{excerpt}</p>
                    <Cta shouldRenderLinks text={cta.text} url={cta.url} />
                </>
            ) : (
                <ExpandableText
                    blocks={body}
                    containerType="latest-announcement"
                    alwaysExpanded={isStandalone}
                    onReadMore={onReadMore}
                >
                    {authorByline}
                </ExpandableText>
            )}
        </div>
    )
}
