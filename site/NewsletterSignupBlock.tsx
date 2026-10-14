import cx from "clsx"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import { NewsletterSignup } from "./NewsletterSubscription.js"
import { OwidSocials } from "./OwidSocials.js"

export const NewsletterSignupBlock = ({
    context,
    className,
}: {
    context: NewsletterSubscriptionContext
    className?: string
}) => {
    return (
        <NewsletterSignup
            className={cx("newsletter-signup", className)}
            context={context}
        >
            <OwidSocials context={context} />
        </NewsletterSignup>
    )
}
