import { formatAuthors, OwidGdocType } from "@ourworldindata/utils"
import { PageChronologicalDataInsightRecord } from "@ourworldindata/types"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import Image from "../gdocs/components/Image.js"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"
import cx from "clsx"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import {
    LATEST_HIT_GRID_CLASSES,
    LatestFeedView,
    findThumbnailImageBlock,
    makeAttachments,
} from "./latestUtils.js"
import { useLatestContext } from "./LatestContext.js"
import { useIsLikelyBaked } from "./latestHooks.js"
import { LatestDataInsightExpandable } from "./LatestDataInsightExpandable.js"

/**
 * Data insight card for the /latest feed. Two presentations, picked by
 * `view`:
 *
 * - No view (the unfiltered feed): a condensed teaser — thumbnail beside a
 *   clipped body — that links to the insight's own page.
 * - A view (the data-insight-filtered feed, which offers the View toggle):
 *   the whole insight read in place, expanded or compact. See
 *   LatestDataInsightExpandable.
 */
export const LatestDataInsightHit = ({
    hit,
    selectedTopic,
    position,
    view,
    isExpanded,
}: {
    hit: PageChronologicalDataInsightRecord
    selectedTopic?: string
    position: number
    view?: LatestFeedView
    /** For the in-place presentation: start expanded (the View toggle says
     * so, or the reader deep-linked to this card). */
    isExpanded: boolean
}) => {
    if (view) {
        return (
            <LatestDataInsightExpandable
                // Remount on toggle so a card the reader expanded by hand
                // collapses again when they switch back to Compact.
                key={view}
                hit={hit}
                selectedTopic={selectedTopic}
                position={position}
                isExpanded={isExpanded}
            />
        )
    }
    return (
        <CondensedDataInsightHit
            hit={hit}
            selectedTopic={selectedTopic}
            position={position}
        />
    )
}

const CondensedDataInsightHit = ({
    hit,
    selectedTopic,
    position,
}: {
    hit: PageChronologicalDataInsightRecord
    selectedTopic?: string
    position: number
}) => {
    const { analytics } = useLatestContext()
    const href = getPrefixedGdocPath("", {
        slug: hit.slug,
        content: { type: OwidGdocType.DataInsight },
    })
    const isLikelyBaked = useIsLikelyBaked(hit)
    const firstImage = findThumbnailImageBlock(hit.body)
    const otherBlocks = hit.body.filter((block) => block !== firstImage)
    const titleId = `latest-hit-${hit.slug}-title`

    if (!isLikelyBaked) return null

    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                className={cx(
                    "latest-data-insight-hit",
                    LATEST_HIT_GRID_CLASSES
                )}
            >
                <LatestHitMetadata
                    latestType={hit.latestType}
                    tags={hit.tags}
                    publishedAt={hit.date}
                    selectedTopic={selectedTopic}
                />
                <a
                    href={href}
                    aria-labelledby={titleId}
                    className="latest-data-insight-hit__card grid grid-cols-8"
                    onClick={() =>
                        analytics.logLatestResultClick(hit, position)
                    }
                >
                    {firstImage && (
                        <Image
                            className="latest-data-insight-hit__image span-cols-3"
                            filename={firstImage.filename}
                            containerType="latest-data-insight"
                            shouldLightbox={false}
                        />
                    )}
                    <div className="latest-data-insight-hit__content span-cols-5">
                        <h2
                            id={titleId}
                            className="latest-data-insight-hit__title body-1-bold"
                        >
                            {hit.title}
                        </h2>
                        <p className="latest-data-insight-hit__authors">
                            {formatAuthors(hit.authors)}
                        </p>
                        <div className="latest-data-insight-hit__blocks">
                            <ArticleBlocks
                                blocks={otherBlocks}
                                shouldRenderLinks={false}
                            />
                        </div>
                    </div>
                </a>
            </article>
        </AttachmentsContext.Provider>
    )
}
