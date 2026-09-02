import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBell, faEnvelopeOpenText } from "@fortawesome/free-solid-svg-icons"
import { Button } from "@ourworldindata/components"
import { LatestUrlParam } from "@ourworldindata/types"
import { IS_ARCHIVE } from "../settings/clientSettings.js"
import { PROD_URL } from "./SiteConstants.js"
import { hasTopicNewsletterCard } from "./topicNewsletter.js"

// We don't archive the subscribe page.
const BASE_URL = IS_ARCHIVE ? PROD_URL : ""

export default function TopicNewsletterCard({
    topicArea,
    pageType = "topic",
    variant = "wide",
    className,
}: {
    topicArea?: string
    pageType?: "topic" | "chart"
    /** "narrow" drops "Subscribe to" from the copy for ~300px-wide slots. */
    variant?: "wide" | "narrow"
    className?: string
}) {
    if (!hasTopicNewsletterCard(topicArea)) return null

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
                href={`${BASE_URL}/subscribe?${new URLSearchParams({ [LatestUrlParam.TOPICS]: topicArea })}`}
                dataTrackNote="topic_newsletter_subscribe"
            />
        </div>
    )
}
