import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBell, faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons"
import { Button } from "@ourworldindata/components"
import { IS_ARCHIVE } from "../settings/clientSettings.js"
import { PROD_URL } from "./SiteConstants.js"
import { getTopicNewsletterSubscribeUrl } from "./topicNewsletter.js"

// We don't archive the subscribe page.
const BASE_URL = IS_ARCHIVE ? PROD_URL : ""

/**
 * Right-rail card inviting readers to subscribe to updates about the top-level
 * topic area a page belongs to. Renders nothing when the page doesn't resolve
 * to an area.
 *
 * See `getTopicNewsletterSubscribeUrl` for why the button is a link to
 * /subscribe rather than an inline form.
 */
export default function TopicNewsletterCard({
    topicArea,
    pageType = "topic",
    variant = "wide",
    className,
}: {
    topicArea?: string
    pageType?: "topic" | "chart"
    // Slots around 300px wide pass "narrow" to get shorter body copy, which
    // keeps it to two lines. Nothing is lost by dropping "Subscribe to": the
    // button right below the copy says it.
    variant?: "wide" | "narrow"
    className?: string
}) {
    if (!topicArea) return null

    const heading =
        pageType === "chart"
            ? "Interested in this chart?"
            : "Interested in this topic?"

    return (
        <div className={cx("topic-newsletter-card", className)}>
            <div className="topic-newsletter-card__header">
                <FontAwesomeIcon icon={faBell} />
                <h3 className="topic-newsletter-card__heading h4-semibold">
                    {heading}
                </h3>
            </div>
            <p className="topic-newsletter-card__p body-3-medium">
                {variant === "narrow"
                    ? "Get email updates on all our work about"
                    : "Subscribe to get email updates on all our work about"}{" "}
                <strong>{topicArea}</strong>.
            </p>
            <Button
                className="topic-newsletter-card__button"
                theme="outline-vermillion"
                text="Subscribe"
                icon={faEnvelopeOpenText}
                iconPosition="left"
                href={getTopicNewsletterSubscribeUrl(BASE_URL, topicArea)}
                dataTrackNote="topic_newsletter_subscribe"
            />
        </div>
    )
}
