import { formatAuthors } from "@ourworldindata/utils"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import cx from "clsx"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"
import Image from "../gdocs/components/Image.js"
import { useLinkedChart } from "../gdocs/utils.js"
import { LatestFeedCardMedia } from "./latestUtils.js"

/**
 * The shared /latest card layout, in two states.
 *
 * Compact (the default): a thumbnail on the left, title + authors + body on the
 * right, with the text column clipped by a fade-out gradient. Used by both data
 * insight and data update hits, so the two read as one card design in the feed.
 *
 * Expanded (`isExpanded`, set when the feed is filtered to this card's own
 * type): a single column — title, authors, figure, then the full body, ending
 * on the body's {.cta}. The figure moves inside the text column so the card
 * reads the way the item's own page does, and is capped by CSS rather than
 * stretched to the card width, keeping it supporting evidence rather than a
 * hero image.
 *
 * The whole card is a single <a> to the item's own page, which is why the body
 * renders with `shouldRenderLinks={false}` — inline links would nest inside
 * that anchor.
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

    // Compact: the figure is a grid child of the card, in its own column.
    // Expanded: it sits inside the text column, so it takes no grid span and is
    // capped by .latest-feed-card--expanded .latest-feed-card__image instead.
    const imageClassName = cx("latest-feed-card__image", {
        "span-cols-3": !isExpanded,
    })

    // `latest-data-insight` is the existing image-sizing container for this
    // card layout; both card types share it now that the layout is shared.
    const figure =
        media?.kind === "image" ? (
            <Image
                className={imageClassName}
                filename={media.filename}
                containerType="latest-data-insight"
                shouldLightbox={false}
            />
        ) : linkedChart?.thumbnail ? (
            <img
                className={imageClassName}
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
            {!isExpanded && figure}
            <div
                className={cx(
                    "latest-feed-card__content",
                    figure && !isExpanded ? "span-cols-5" : "span-cols-8"
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
                {isExpanded && figure}
                <div className="latest-feed-card__blocks">
                    <ArticleBlocks blocks={blocks} shouldRenderLinks={false} />
                </div>
            </div>
        </a>
    )
}
