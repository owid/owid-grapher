import { LatestNewsletter } from "@ourworldindata/types"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons"
import { NewsletterIcon } from "../gdocs/components/NewsletterIcon.js"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import { LATEST_HIT_GRID_CLASSES } from "./latestUtils.js"
import { useLatestContext } from "./LatestContext.js"

// The OWID Brief has a single standing author; the Mailchimp API doesn't
// expose authorship, so it's not part of the synced newsletter data.
const NEWSLETTER_AUTHOR = "Charlie Giattino"

/**
 * Newsletter tile for the /latest feed. Unlike the other hit types this
 * links out to the Mailchimp campaign-archive page (in a new tab) rather
 * than to a page on our site.
 */
export const LatestNewsletterHit = ({
    hit,
    position,
}: {
    hit: LatestNewsletter
    position: number
}) => {
    const { analytics } = useLatestContext()
    const titleId = `latest-hit-newsletter-${hit.mailchimpId}-title`
    return (
        <article
            id={`newsletter-${hit.mailchimpId}`}
            aria-labelledby={titleId}
            className={cx("latest-newsletter-hit", LATEST_HIT_GRID_CLASSES)}
        >
            <LatestHitMetadata latestType="newsletter" publishedAt={hit.date} />
            <div className="latest-newsletter-hit__card">
                <NewsletterIcon className="latest-newsletter-hit__icon" />
                <div className="latest-newsletter-hit__content">
                    <h2 id={titleId} className="latest-newsletter-hit__title">
                        <a
                            href={hit.url}
                            target="_blank"
                            rel="noopener"
                            className="latest-newsletter-hit__title-link"
                            onClick={() =>
                                analytics.logLatestNewsletterClick(
                                    hit,
                                    position
                                )
                            }
                        >
                            {hit.title}
                            <FontAwesomeIcon
                                icon={faArrowUpRightFromSquare}
                                className="latest-newsletter-hit__external-icon"
                            />
                        </a>
                    </h2>
                    <p className="latest-newsletter-hit__byline">
                        {NEWSLETTER_AUTHOR}
                    </p>
                    <p className="latest-newsletter-hit__description">
                        A twice-monthly digest of our latest work plus curated
                        highlights from across Our World in Data.
                    </p>
                </div>
            </div>
        </article>
    )
}
