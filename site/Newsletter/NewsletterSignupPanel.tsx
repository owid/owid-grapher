import * as React from "react"
import cx from "clsx"
import { NewsletterSubscriptionContext } from "../newsletter.js"
import { NewsletterIcon } from "../gdocs/components/NewsletterIcon.js"
import { NewsletterSignupForm } from "./NewsletterSignupForm.js"

/**
 * The compact signup form with its heading. It looks the same wherever it
 * appears (header nav, site tools, homepage, /latest), so containers only
 * position it; see NewsletterSignupPanel.scss.
 */
export const NewsletterSignupPanel = ({
    context,
    className,
    showSubheading = false,
    children,
}: {
    context: NewsletterSubscriptionContext
    className?: string
    showSubheading?: boolean
    children?: React.ReactNode
}) => (
    <div className={cx("newsletter-signup-panel", className)}>
        <div className="newsletter-signup-panel__header">
            <NewsletterIcon className="newsletter-signup-panel__icon" />
            <h4 className="newsletter-signup-panel__heading">
                Subscribe to our newsletters
            </h4>
            {showSubheading && (
                <span className="newsletter-signup-panel__subheading">
                    Receive our latest work by email
                </span>
            )}
        </div>
        <NewsletterSignupForm context={context} />
        {children}
    </div>
)
