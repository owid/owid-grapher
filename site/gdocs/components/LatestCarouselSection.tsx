import cx from "clsx"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import LatestCarousel, { LatestCarouselItem } from "./LatestCarousel.js"

/** The "Our latest …" section at the bottom of a standalone page: heading,
 * "See all" link, and the carousel itself. Renders nothing when there's
 * nothing to show. */
export default function LatestCarouselSection({
    className,
    heading,
    seeAllText,
    seeAllHref,
    items,
}: {
    className?: string
    heading: string
    seeAllText: string
    seeAllHref: string
    items: LatestCarouselItem[]
}) {
    if (!items.length) return null

    return (
        <div className={cx(className, "latest-carousel-section")}>
            <h2 className="h2-bold">{heading}</h2>
            <a href={seeAllHref} className="latest-carousel-section__see-all">
                {seeAllText} <FontAwesomeIcon icon={faArrowRight} />
            </a>
            <LatestCarousel
                className="latest-carousel-section__carousel"
                items={items}
                seeAllHref={seeAllHref}
                seeAllText={seeAllText}
            />
        </div>
    )
}
