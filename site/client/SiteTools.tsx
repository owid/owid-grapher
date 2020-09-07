import * as React from "react"
import * as ReactDOM from "react-dom"
import { FeedbackPrompt } from "./Feedback"
import {
    NewsletterSubscription,
    NewsletterSubscriptionForm,
    NewsletterSubscriptionContext,
} from "./NewsletterSubscription"

const SiteTools = () => {
    return (
        <>
            <NewsletterSubscription
                context={NewsletterSubscriptionContext.Floating}
            />
            <FeedbackPrompt />
        </>
    )
}

export const runSiteTools = () => {
    ReactDOM.render(<SiteTools />, document.querySelector(".site-tools"))

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
