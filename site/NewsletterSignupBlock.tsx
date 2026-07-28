import cx from "clsx"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import {
    NewsletterSubscriptionForm,
    NewsletterSubscriptionHeader,
} from "./NewsletterSubscription.js"
import { OwidSocials } from "./OwidSocials.js"

export const NewsletterSignupBlock = ({
    context,
    className,
    topicArea,
}: {
    context: NewsletterSubscriptionContext
    className?: string
    /** Only used in the Latest context — see NewsletterSubscriptionForm. */
    topicArea?: string
}) => {
    const isLatest = context === NewsletterSubscriptionContext.Latest
    return (
        <div
            className={cx(
                "newsletter-signup",
                { "newsletter-signup--latest": isLatest },
                className
            )}
        >
            <NewsletterSubscriptionHeader />
            <NewsletterSubscriptionForm
                context={context}
                topicArea={topicArea}
            />
            <OwidSocials context={context} />
        </div>
    )
}
