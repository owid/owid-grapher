import * as React from "react"
import cx from "clsx"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import LatestCarousel, {
    LatestCarouselItem,
    LatestCarouselTheme,
} from "./LatestCarousel.js"

/** The "Our latest …" section at the bottom of a standalone page: heading,
 * "See all" link, and the carousel itself (or `children` in its place).
 * Renders nothing when there's nothing to show. */
export default function LatestCarouselSection({
    className,
    heading,
    seeAllText,
    seeAllHref,
    items,
    theme,
    tall,
    seeAll,
    children,
}: {
    className?: string
    heading: string
    seeAllText: string
    seeAllHref: string
    items: LatestCarouselItem[]
    theme?: LatestCarouselTheme
    tall?: boolean
    /** Rendered instead of the default "See all" link, e.g. to give it a
     * track note. Build it from LatestCarouselSectionSeeAll. */
    seeAll?: React.ReactNode
    /** Rendered instead of the carousel, e.g. to show the items in another
     * layout. Give it the `latest-carousel-section__items` class to span the
     * section's width. */
    children?: React.ReactNode
}) {
    if (!items.length) return null

    return (
        <div className={cx(className, "latest-carousel-section")}>
            <h2 className="h2-bold">{heading}</h2>
            {seeAll ?? (
                <LatestCarouselSectionSeeAll
                    href={seeAllHref}
                    text={seeAllText}
                />
            )}
            {children ?? (
                <LatestCarousel
                    className="latest-carousel-section__items"
                    items={items}
                    seeAllHref={seeAllHref}
                    seeAllText={seeAllText}
                    theme={theme}
                    tall={tall}
                />
            )}
        </div>
    )
}

/** The section's "See all" link, hidden on small screens, where the
 * carousel ends with its own "See all" card. */
export function LatestCarouselSectionSeeAll({
    className,
    href,
    text,
    trackNote,
}: {
    className?: string
    href: string
    text: string
    trackNote?: string
}) {
    return (
        <a
            href={href}
            className={cx("latest-carousel-section__see-all", className)}
            data-track-note={trackNote}
        >
            {text} <FontAwesomeIcon icon={faArrowRight} />
        </a>
    )
}
