import { formatAuthors } from "@ourworldindata/utils"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { ArticleBlocks } from "../gdocs/components/ArticleBlocks.js"

/**
 * A data insight rendered in the feed the way it renders on its own page.
 *
 * When the feed is filtered to data insights, the compact LatestFeedCard is
 * replaced by this: the white card, large title and full-width figure of
 * /data-insights/<slug>. It deliberately carries the `data-insight-body` class
 * of DataInsightBody (site/gdocs/pages/DataInsight.tsx) so the two are styled
 * by one rule set and can't drift apart — LatestDataInsightExpandedCard.scss
 * only adds what differs in a feed.
 *
 * Three things from the detail page are left out:
 *  - its dateline, because the feed's own metadata row above the card already
 *    carries the date (alongside the type and topic);
 *  - the author avatars, because data insight records don't carry
 *    `linkedAuthors` (see makeAttachments) and LinkedAuthor would emit an <a>
 *    inside this card's <a>;
 *  - the "Related topics" / "Copy link" / "Share" footer, which is
 *    page-level: those are buttons and links, and can't nest in this anchor.
 *
 * The body renders in its authored order — data insights lead with their
 * {.image} — rather than having the figure split out the way the compact card
 * does, which is what makes the card read like the page.
 */
export const LatestDataInsightExpandedCard = ({
    href,
    title,
    titleId,
    authors,
    blocks,
    onClick,
}: {
    href: string
    title: string
    titleId: string
    authors: string[]
    blocks: OwidEnrichedGdocBlock[]
    onClick?: () => void
}) => {
    return (
        <a
            href={href}
            aria-labelledby={titleId}
            className="latest-data-insight-expanded-card data-insight-body"
            onClick={onClick}
        >
            <h2
                id={titleId}
                className="latest-data-insight-expanded-card__title display-3-semibold"
            >
                {title}
            </h2>
            {authors.length > 0 && (
                <p className="latest-data-insight-expanded-card__authors body-3-medium">
                    {formatAuthors(authors)}
                </p>
            )}
            <div className="data-insight-blocks">
                <ArticleBlocks
                    blocks={blocks}
                    containerType="data-insight"
                    shouldRenderLinks={false}
                    interactiveImages={false}
                />
            </div>
        </a>
    )
}
