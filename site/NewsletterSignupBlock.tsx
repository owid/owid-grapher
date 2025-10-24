import cx from "classnames"
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
    return (
        <div className={cx("newsletter-signup", className)}>
            <NewsletterSubscriptionHeader />
            <NewsletterSubscriptionForm context={context} />
            <OwidSocials context={context} />
        </div>
    )
}
