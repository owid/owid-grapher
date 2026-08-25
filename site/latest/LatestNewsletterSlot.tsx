import cx from "clsx"
import { NewsletterSignupBlock } from "../NewsletterSignupBlock.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"
import TopicNewsletterCard from "../TopicNewsletterCard.js"
import { hasTopicNewsletterCard } from "../topicNewsletter.js"
import { LATEST_SIDEBAR_GRID_CLASSES } from "./latestUtils.js"

/**
 * The /latest sidebar: the full signup block, or the topic card once a topic
 * area is selected. Format-only filters (`?type=…`) carry no topic area.
 */
export const LatestNewsletterSlot = ({ topicArea }: { topicArea?: string }) =>
    hasTopicNewsletterCard(topicArea) ? (
        <TopicNewsletterCard
            className={cx(
                "topic-newsletter-card--latest",
                LATEST_SIDEBAR_GRID_CLASSES
            )}
            topicArea={topicArea}
            variant="narrow"
        />
    ) : (
        <NewsletterSignupBlock
            className={cx(
                "latest-page__newsletter-signup",
                LATEST_SIDEBAR_GRID_CLASSES
            )}
            context={NewsletterSubscriptionContext.Latest}
        />
    )
