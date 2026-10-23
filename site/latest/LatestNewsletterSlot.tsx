import cx from "clsx"
import { NewsletterSignupBlock } from "../NewsletterSignupBlock.js"
import { NewsletterSubscriptionContext } from "../newsletter.js"
import TopicNewsletterCard from "../TopicNewsletterCard.js"
import { hasTopicNewsletterCard } from "../topicNewsletter.js"
import { LATEST_NEWSLETTER_SIGNUP_CLASSES } from "./latestUtils.js"

/**
 * The /latest sidebar: the full signup block, or the topic card once a topic
 * area is selected. Format-only filters (`?type=…`) carry no topic area.
 */
export const LatestNewsletterSlot = ({ topicArea }: { topicArea?: string }) =>
    hasTopicNewsletterCard(topicArea) ? (
        <TopicNewsletterCard
            className={cx(
                "topic-newsletter-card--latest",
                LATEST_NEWSLETTER_SIGNUP_CLASSES
            )}
            topicArea={topicArea}
            placement="latest"
            variant="narrow"
        />
    ) : (
        <NewsletterSignupBlock
            className={LATEST_NEWSLETTER_SIGNUP_CLASSES}
            context={NewsletterSubscriptionContext.Latest}
        />
    )
