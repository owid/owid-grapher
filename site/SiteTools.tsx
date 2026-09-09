import { FeedbackPrompt } from "./Feedback.js"
import { NewsletterSubscriptionContext } from "./newsletter.js"
import { NewsletterSubscription } from "./NewsletterSubscription.js"
// Uncomment along with the Jobs button below when a job posting goes live.
// import { faHandshake } from "@fortawesome/free-solid-svg-icons"
// import { SiteToolsButton } from "./SiteToolsButton.js"

export const SITE_TOOLS_ROOT_CLASS = "site-tools-root"

export default function SiteTools() {
    return (
        <div className="site-tools">
            <NewsletterSubscription
                context={NewsletterSubscriptionContext.Floating}
            />
            <FeedbackPrompt />
            {/* <SiteToolsButton
                icon={faHandshake}
                label="Jobs"
                href="/jobs"
                dataTrackNote="page_open_jobs"
            /> */}
        </div>
    )
}
