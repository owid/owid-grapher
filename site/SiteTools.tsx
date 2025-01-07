import cx from "classnames"
import { FeedbackPrompt } from "./Feedback.js"
import { ScrollDirection, useScrollDirection } from "./hooks.js"
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
// import { faHeart } from "@fortawesome/free-solid-svg-icons"
// import { faHandshake } from "@fortawesome/free-solid-svg-icons"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import { NewsletterSubscription } from "./NewsletterSubscription.js"

export const SITE_TOOLS_CLASS = "site-tools"

export default function SiteTools() {
    const scrollDirection = useScrollDirection()
    // const isDonatePage = window.location.pathname === "/donate"

    return (
        <div
            className={cx("hide-wrapper", {
                hide: scrollDirection === ScrollDirection.Down,
            })}
        >
            {/* {!isDonatePage && (
                <a
                    className="prompt prompt-donate"
                    data-track-note="page_open_donate"
                    href="/donate"
                >
                    <FontAwesomeIcon icon={faHeart} />
                    Donate
                </a>
            )} */}
            <NewsletterSubscription
                context={NewsletterSubscriptionContext.Floating}
            />
            <FeedbackPrompt />
            {/* <a className="prompt" data-track-note="page_open_jobs" href="/jobs">
                <FontAwesomeIcon icon={faHandshake} /> Jobs
            </a> */}
        </div>
    )
}
