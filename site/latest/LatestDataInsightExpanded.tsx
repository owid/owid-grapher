import { PageChronologicalDataInsightRecord } from "@ourworldindata/types"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import Image from "../gdocs/components/Image.js"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"
import LinkedAuthor from "../gdocs/components/LinkedAuthor.js"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import { findThumbnailImageBlock, makeAttachments } from "./latestUtils.js"

/**
 * The expanded data insight card of the type-filtered /latest feed: the whole
 * insight read in place — title, avatar byline, the chart at full card width,
 * then the text — rather than a teaser linking out to its page (that's
 * LatestDataInsightHit's condensed card).
 *
 * The card is inert; readers navigate through the body links and CTA.
 *
 * Narrower than the other feed cards on desktop — six columns, a reading
 * column like the standalone data insight page.
 */
export const LatestDataInsightExpanded = ({
    hit,
    selectedTopic,
}: {
    hit: PageChronologicalDataInsightRecord
    selectedTopic?: string
}) => {
    const firstImage = findThumbnailImageBlock(hit.body)
    const otherBlocks = hit.body.filter((block) => block !== firstImage)
    const titleId = `latest-hit-${hit.slug}-title`

    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                aria-labelledby={titleId}
                className="latest-data-insight-expanded span-cols-6 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"
            >
                <LatestHitMetadata
                    latestType={hit.latestType}
                    tags={hit.tags}
                    publishedAt={hit.date}
                    selectedTopic={selectedTopic}
                />
                <div className="latest-data-insight-expanded__card">
                    <h2
                        id={titleId}
                        className="latest-data-insight-expanded__title body-1-bold"
                    >
                        {hit.title}
                    </h2>
                    {hit.authors.length > 0 && (
                        <div className="latest-data-insight-expanded__authors body-3-medium">
                            {hit.authors.map((author, index) => (
                                <LinkedAuthor
                                    key={index}
                                    className="latest-data-insight-expanded__author"
                                    name={author}
                                    includeImage={true}
                                />
                            ))}
                        </div>
                    )}
                    {firstImage && (
                        <Image
                            className="latest-data-insight-expanded__image"
                            filename={firstImage.filename}
                            containerType="latest-data-insight-expanded"
                            shouldLightbox={false}
                        />
                    )}
                    <div className="latest-data-insight-expanded__blocks">
                        <ArticleBlocks
                            blocks={otherBlocks}
                            containerType="data-insight"
                        />
                    </div>
                </div>
            </article>
        </AttachmentsContext.Provider>
    )
}
