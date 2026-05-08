import { formatAuthors, OwidGdocType } from "@ourworldindata/utils"
import { PageChronologicalRecord } from "@ourworldindata/types"
import { getPrefixedGdocPath } from "@ourworldindata/components"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import Image from "../gdocs/components/Image.js"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import cx from "classnames"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import { LATEST_HIT_GRID_CLASSES, makeAttachments } from "./latestUtils.js"
import { useLatestContext } from "./LatestContext.js"

/**
 * Article card for the /latest feed.
 *
 * The excerpt has two modes: plain text by default, or full ArticleBlocks
 * (internal links, formatting, …) when `latest-excerpt` is set on the
 * gdoc. The rich mode also renders a "Read the article" affordance.
 *
 * `latest-featured-image` separately swaps the card thumbnail without
 * affecting the article page's `featured-image`.
 */
export const LatestArticleHit = ({
    hit,
    selectedTopic,
    position,
}: {
    hit: PageChronologicalRecord
    selectedTopic?: string
    position: number
}) => {
    const { analytics } = useLatestContext()
    const hasRichExcerpt = !!hit.latestExcerpt?.length
    const href = getPrefixedGdocPath("", {
        slug: hit.slug,
        content: { type: OwidGdocType.Article },
    })
    const titleId = `latest-hit-${hit.slug}-title`
    const handleResultClick = () =>
        analytics.logLatestResultClick(hit, position)
    return (
        <AttachmentsContext.Provider value={makeAttachments(hit)}>
            <article
                id={hit.slug}
                aria-labelledby={titleId}
                className={cx("latest-article-hit", LATEST_HIT_GRID_CLASSES)}
            >
                <LatestHitMetadata
                    latestType={hit.latestType}
                    tags={hit.tags}
                    publishedAt={hit.date}
                    selectedTopic={selectedTopic}
                />
                <div className="latest-article-hit__card grid grid-cols-8">
                    {(hit.latestFeaturedImage || hit.featuredImage) && (
                        <Image
                            filename={
                                hit.latestFeaturedImage ?? hit.featuredImage
                            }
                            className="latest-article-hit__image span-cols-3"
                            containerType="latest-article"
                            shouldLightbox={false}
                        />
                    )}
                    <div className="latest-article-hit__content span-cols-5">
                        <h2 id={titleId} className="latest-article-hit__title">
                            <a
                                href={href}
                                className="latest-article-hit__title-link"
                                onClick={handleResultClick}
                            >
                                {hit.title}
                            </a>
                        </h2>
                        <p className="latest-article-hit__authors">
                            {formatAuthors(hit.authors)}
                        </p>
                        {hasRichExcerpt ? (
                            <>
                                <div className="latest-article-hit__excerpt latest-article-hit__excerpt--rich">
                                    <ArticleBlocks
                                        blocks={hit.latestExcerpt!}
                                        shouldRenderLinks={true}
                                    />
                                </div>
                                <a
                                    href={href}
                                    className="latest-article-hit__read-more"
                                    onClick={handleResultClick}
                                >
                                    Read the article
                                    <FontAwesomeIcon icon={faArrowRight} />
                                </a>
                            </>
                        ) : (
                            <p className="latest-article-hit__excerpt">
                                {hit.excerpt}
                            </p>
                        )}
                    </div>
                </div>
            </article>
        </AttachmentsContext.Provider>
    )
}
