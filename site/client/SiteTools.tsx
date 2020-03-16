import * as React from "react"
import * as ReactDOM from "react-dom"
import { FeedbackPrompt } from "./Feedback"
import {
    NewsletterSubscription,
    NewsletterSubscriptionForm
} from "./NewsletterSubscription"

const SiteTools = () => {
    return (
        <>
            <NewsletterSubscription />
            <FeedbackPrompt />
        </>
    )
}

export const runSiteTools = () => {
    ReactDOM.render(<SiteTools />, document.querySelector(".site-tools"))
    ReactDOM.hydrate(
        <NewsletterSubscriptionForm context="homepage" />,
        document.querySelector(
            ".homepage-subscribe .newsletter-subscription .root"
        )
    )
}
