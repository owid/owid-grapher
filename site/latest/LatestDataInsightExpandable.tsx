import { useState } from "react"
import cx from "clsx"
import { PageChronologicalDataInsightRecord } from "@ourworldindata/types"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import Image from "../gdocs/components/Image.js"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"
import LinkedAuthor from "../gdocs/components/LinkedAuthor.js"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import { findThumbnailImageBlock, makeAttachments } from "./latestUtils.js"
import { useLatestContext } from "./LatestContext.js"

/**
 * The data insight card of the type-filtered /latest feed: the whole insight
 * read in place — title, avatar byline, the chart at full card width, then the
 * text — rather than a teaser linking out to its page (that's
 * LatestDataInsightHit's condensed card, used in the unfiltered feed).
 *
 * Two states. Expanded is the whole thing and isn't clickable: there's
 * nowhere left to go. Compact keeps the title, byline and chart and clips the
 * text to a few lines under a fade; clicking anywhere on the card expands it
 * in place, one-way. `isExpanded` is the parent's say (the View toggle, or a
 * deep link straight to this card); the reader's own click is local state.
 *
 * The click target is a real <button> stretched over the card, not a button
 * wrapping it — a button can't contain headings and paragraphs. The byline
 * sits above that overlay so author links stay clickable.
 *
 * Narrower than the other feed cards on desktop — six columns, a reading
 * column like the standalone data insight page.
 */
export const LatestDataInsightExpandable = ({
    hit,
    selectedTopic,
    position,
    isExpanded,
}: {
    hit: PageChronologicalDataInsightRecord
    selectedTopic?: string
    position: number
    isExpanded: boolean
}) => {
    const { analytics } = useLatestContext()
    const [hasReaderExpanded, setHasReaderExpanded] = useState(false)
    const expanded = isExpanded || hasReaderExpanded
    const firstImage = findThumbnailImageBlock(hit.body)
    const otherBlocks = hit.body.filter((block) => block !== firstImage)
    const titleId = `latest-hit-${hit.slug}-title`

    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                aria-labelledby={titleId}
                className="latest-data-insight-expandable span-cols-6 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"
            >
                <LatestHitMetadata
                    latestType={hit.latestType}
                    tags={hit.tags}
                    publishedAt={hit.date}
                    selectedTopic={selectedTopic}
                />
                <div
                    className={cx("latest-data-insight-expandable__card", {
                        "latest-data-insight-expandable__card--compact":
                            !expanded,
                    })}
                >
                    <h2
                        id={titleId}
                        className="latest-data-insight-expandable__title body-1-bold"
                    >
                        {hit.title}
                    </h2>
                    {hit.authors.length > 0 && (
                        <div className="latest-data-insight-expandable__authors body-3-medium">
                            {hit.authors.map((author, index) => (
                                <LinkedAuthor
                                    key={index}
                                    className="latest-data-insight-expandable__author"
                                    name={author}
                                    includeImage={true}
                                />
                            ))}
                        </div>
                    )}
                    {firstImage && (
                        <Image
                            className="latest-data-insight-expandable__image"
                            filename={firstImage.filename}
                            containerType="latest-data-insight-expandable"
                            shouldLightbox={false}
                        />
                    )}
                    <div
                        className={cx(
                            "latest-data-insight-expandable__blocks",
                            {
                                "latest-data-insight-expandable__blocks--clipped":
                                    !expanded,
                            }
                        )}
                    >
                        <ArticleBlocks
                            blocks={otherBlocks}
                            containerType="data-insight"
                        />
                    </div>
                    {!expanded && (
                        <button
                            type="button"
                            className="latest-data-insight-expandable__expand"
                            aria-label={`Read more: ${hit.title}`}
                            onClick={() => {
                                setHasReaderExpanded(true)
                                analytics.logLatestDataInsightExpand(
                                    hit,
                                    position
                                )
                            }}
                        />
                    )}
                </div>
            </article>
        </AttachmentsContext.Provider>
    )
}
