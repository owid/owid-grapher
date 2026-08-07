import { NewsletterSignupBlock } from "../NewsletterSignupBlock.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"
import TopicNewsletterCard from "../TopicNewsletterCard.js"
import {
    LATEST_NEWSLETTER_GRID_CLASSES,
    LATEST_TOPIC_CARD_GRID_CLASSES,
} from "./latestUtils.js"

/**
 * The right-hand slot on /latest.
 *
 * With no topic area selected it holds the full newsletter signup block.
 * Selecting a topic area replaces the whole block with the topic card for that
 * area; switching areas updates the card, and clearing back to "All" brings the
 * block back.
 *
 * Format-only filters (`?type=…`) carry no topic area, so they keep the block —
 * see LATEST_TYPE_VALUES.
 */
export const LatestNewsletterSlot = ({ topicArea }: { topicArea?: string }) => {
    if (topicArea) {
        return (
            <TopicNewsletterCard
                className={LATEST_TOPIC_CARD_GRID_CLASSES}
                topicArea={topicArea}
                // The slot renders at ~300px, so take the shorter copy that
                // keeps the sentence to two lines.
                variant="narrow"
            />
        )
    }
    return (
        <NewsletterSignupBlock
            className={LATEST_NEWSLETTER_GRID_CLASSES}
            context={NewsletterSubscriptionContext.Latest}
        />
    )
}
