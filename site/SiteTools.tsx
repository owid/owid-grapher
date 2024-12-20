import React from "react"
import ReactDOM from "react-dom"
import cx from "classnames"
import { FeedbackPrompt } from "./Feedback.js"
import { ScrollDirection, useScrollDirection } from "./hooks.js"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import {
    // NewsletterSubscription,
    NewsletterSubscriptionForm,
} from "./NewsletterSubscription.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faHeart } from "@fortawesome/free-solid-svg-icons"
// import { faHandshake } from "@fortawesome/free-solid-svg-icons"

const SITE_TOOLS_CLASS = "site-tools"

const SiteTools = () => {
    const scrollDirection = useScrollDirection()
    const isDonatePage = window.location.pathname === "/donate"

    return (
        <div
            className={cx("hide-wrapper", {
                hide: scrollDirection === ScrollDirection.Down,
            })}
        >
            {!isDonatePage && (
                <a
                    className="prompt prompt-donate"
                    data-track-note="page_open_donate"
                    href="/donate"
                >
                    <FontAwesomeIcon icon={faHeart} />
                    Donate
                </a>
            )}
            {/* <NewsletterSubscription
                context={NewsletterSubscriptionContext.Floating}
            /> */}
            <FeedbackPrompt />
            {/* <a className="prompt" data-track-note="page_open_jobs" href="/jobs">
                <FontAwesomeIcon icon={faHandshake} /> Jobs
            </a> */}
        </div>
    )
}

export const runSiteTools = () => {
    ReactDOM.render(
        <SiteTools />,
        document.querySelector(`.${SITE_TOOLS_CLASS}`)
    )

    const newsletterSubscriptionFormRootHomepage = document.querySelector(
        ".homepage-social-ribbon #newsletter-subscription-root"
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
