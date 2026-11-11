import { PageChronologicalNewsletterRecord } from "@ourworldindata/types"
import { dayjs } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import cx from "clsx"
import { LatestHitMetadata } from "./LatestHitMetadata.js"
import { LATEST_HIT_GRID_CLASSES } from "./latestUtils.js"
import { useLatestContext } from "./LatestContext.js"

function formatEditionDate(isoDate: string): string {
    const date = dayjs(isoDate)
    return date.toDate().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        ...(date.year() !== dayjs().year() && { year: "numeric" }),
    })
}

/**
 * Newsletter card for the /latest feed: an issue of The OWID Brief. It has no
 * page on the site, so the card links out to the issue's archive page.
 */
export const LatestNewsletterHit = ({
    hit,
    position,
}: {
    hit: PageChronologicalNewsletterRecord
    position: number
}) => {
    const { analytics } = useLatestContext()
    const titleId = `latest-hit-${hit.slug}-title`
    const handleResultClick = () =>
        analytics.logLatestResultClick(hit, position)

    return (
        <article
            id={hit.slug}
            aria-labelledby={titleId}
            className={cx("latest-newsletter-hit", LATEST_HIT_GRID_CLASSES)}
        >
            <LatestHitMetadata
                latestType={hit.latestType}
                publishedAt={hit.date}
            />
            <div className="latest-newsletter-hit__card grid grid-cols-8">
                <img
                    className="latest-newsletter-hit__image span-cols-3"
                    src="/images/biweekly-newsletter.webp"
                    alt=""
                    width={1200}
                    height={630}
                    loading="lazy"
                />
                <div className="latest-newsletter-hit__content span-cols-5">
                    <h2 id={titleId} className="latest-newsletter-hit__title">
                        <a
                            href={hit.url}
                            target="_blank"
                            className="latest-newsletter-hit__title-link"
                            onClick={handleResultClick}
                        >
                            {hit.title}
                        </a>
                    </h2>
                    <p className="latest-newsletter-hit__description">
                        The {formatEditionDate(hit.date)} edition of our
                        biweekly roundup—our latest work plus curated highlights
                        from across Our World in Data.
                    </p>
                    <span className="latest-newsletter-hit__read-more">
                        Read the newsletter
                        <FontAwesomeIcon icon={faArrowRight} />
                    </span>
                </div>
            </div>
        </article>
    )
}
