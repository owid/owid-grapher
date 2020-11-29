import * as React from "react"
import * as ReactDOM from "react-dom"
import { FeedbackPrompt } from "./Feedback"
import { ScrollDirection, useScrollDirection } from "./hooks"
import {
    NewsletterSubscription,
    NewsletterSubscriptionForm,
    NewsletterSubscriptionContext,
} from "./NewsletterSubscription"

const SITE_TOOLS_CLASS = "site-tools"

const SiteTools = () => {
    const scrollDirection = useScrollDirection()

    return (
        <div
            className={`hide-wrapper${
                (scrollDirection === ScrollDirection.Down && " hide") || ""
            }`}
        >
            <NewsletterSubscription
                context={NewsletterSubscriptionContext.Floating}
            />
            <FeedbackPrompt />
        </div>
    )
}

export const runSiteTools = () => {
    ReactDOM.render(
        <SiteTools />,
        document.querySelector(`.${SITE_TOOLS_CLASS}`)
    )

    const newsletterSubscriptionFormRootHomepage = document.querySelector(
        ".homepage-subscribe .newsletter-subscription .root"
    )
    if (newsletterSubscriptionFormRootHomepage) {
        ReactDOM.hydrate(
            <NewsletterSubscriptionForm
                context={NewsletterSubscriptionContext.Homepage}
            />,
            newsletterSubscriptionFormRootHomepage
        )
    }
}
