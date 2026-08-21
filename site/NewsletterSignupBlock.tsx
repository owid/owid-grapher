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
}: {
    context: NewsletterSubscriptionContext
    className?: string
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
            <NewsletterSubscriptionForm context={context} />
            <OwidSocials context={context} />
        </div>
    )
}
