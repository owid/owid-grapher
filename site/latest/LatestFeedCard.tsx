import { formatAuthors } from "@ourworldindata/utils"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import cx from "clsx"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"
import Image from "../gdocs/components/Image.js"
import { useLinkedChart } from "../gdocs/utils.js"
import { LatestFeedCardMedia } from "./latestUtils.js"

/**
 * The shared /latest card layout: a thumbnail on the left, title + authors +
 * body blocks on the right. Used by the compact (unfiltered) card of both hit
 * types, so the two read as one card design in the feed, and by the expanded
 * data update card.
 *
 * The whole card is a single <a> to the item's own page, which is why the body
 * renders with `shouldRenderLinks={false}` — inline links would nest inside
 * that anchor.
 *
 * By default the text column is clipped with a fade-out gradient. When the
 * feed is filtered to this card's own type (`isExpanded`) the clamp is dropped
 * and the full body shows, ending on the body's {.cta}; the thumbnail stays in
 * its own column and the text runs on past it.
 *
 * Expanded data insights do NOT use this card — they get the data insight
 * page's own presentation instead, in LatestDataInsightExpandedCard.
 */
export const LatestFeedCard = ({
    href,
    title,
    titleId,
    authors,
    media,
    blocks,
    isExpanded,
    onClick,
}: {
    href: string
    title: string
    titleId: string
    authors: string[]
    media?: LatestFeedCardMedia
    blocks: OwidEnrichedGdocBlock[]
    isExpanded?: boolean
    onClick?: () => void
}) => {
    // Safe to call unconditionally: useLinkedChart bails out on a non-chart
    // URL before touching anything but context.
    const { linkedChart } = useLinkedChart(
        media?.kind === "chart" ? media.url : ""
    )

    // `latest-data-insight` is the existing image-sizing container for this
    // card layout; both card types share it now that the layout is shared.
    const thumbnail =
        media?.kind === "image" ? (
            <Image
                className="latest-feed-card__image span-cols-3"
                filename={media.filename}
                containerType="latest-data-insight"
                shouldLightbox={false}
            />
        ) : linkedChart?.thumbnail ? (
            <img
                className="latest-feed-card__image span-cols-3"
                src={linkedChart.thumbnail}
                alt={linkedChart.title}
                loading="lazy"
            />
        ) : null

    return (
        <a
            href={href}
            aria-labelledby={titleId}
            className={cx("latest-feed-card grid grid-cols-8", {
                "latest-feed-card--expanded": isExpanded,
            })}
            onClick={onClick}
        >
            {thumbnail}
            <div
                className={cx(
                    "latest-feed-card__content",
                    thumbnail ? "span-cols-5" : "span-cols-8"
                )}
            >
                <h2
                    id={titleId}
                    className="latest-feed-card__title body-1-bold"
                >
                    {title}
                </h2>
                {authors.length > 0 && (
                    <p className="latest-feed-card__authors">
                        {formatAuthors(authors)}
                    </p>
                )}
                <div className="latest-feed-card__blocks">
                    <ArticleBlocks blocks={blocks} shouldRenderLinks={false} />
                </div>
            </div>
        </a>
    )
}
