import * as React from "react"
import * as ReactDOM from "react-dom"
import { FeedbackPrompt } from "./Feedback"
import { NewsletterSubscription } from "./NewsletterSubscription"

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
}
