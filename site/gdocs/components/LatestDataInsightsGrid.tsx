import { useCallback, useEffect, useRef, useState } from "react"
import {
    faChevronLeft,
    faChevronRight,
} from "@fortawesome/free-solid-svg-icons"
import { Button, getPrefersReducedMotion } from "@ourworldindata/components"
import { formatDate } from "@ourworldindata/utils"
import cx from "clsx"

import { findThumbnailImageBlock } from "../../latest/latestUtils.js"
import { useImage } from "../utils.js"
import Image from "./Image.js"
import { LatestCarouselItem } from "./LatestCarousel.js"

/**
 * A scrollable row of data insight cards (thumbnail, date, title — the
 * /search data insight card): four in view on desktop, paged with arrow
 * buttons; two on medium screens and one and a bit on mobile, swiped there,
 * followed by a "See all" card on mobile. It holds as many cards as the
 * carousel, so both arms of the homepage data insights experiment offer the
 * same insights (see LatestDataInsightsBlock).
 */
export default function LatestDataInsightsGrid({
    className,
    items,
    seeAllHref,
    seeAllText,
    trackNote,
}: {
    className?: string
    items: LatestCarouselItem[]
    seeAllHref: string
    seeAllText: string
    trackNote?: string
}) {
    const scrollerRef = useRef<HTMLUListElement>(null)
    const [canScrollPrev, setCanScrollPrev] = useState(false)
    const [canScrollNext, setCanScrollNext] = useState(false)

    const updateScrollState = useCallback(() => {
        const scroller = scrollerRef.current
        if (!scroller) return
        const maxScroll = scroller.scrollWidth - scroller.clientWidth
        setCanScrollPrev(scroller.scrollLeft > 1)
        setCanScrollNext(scroller.scrollLeft < maxScroll - 1)
    }, [])

    useEffect(() => {
        const scroller = scrollerRef.current
        if (!scroller) return
        updateScrollState()
        scroller.addEventListener("scroll", updateScrollState, {
            passive: true,
        })
        // Also fires when the grid goes from hidden to shown, e.g. when the
        // QA switcher swaps the experiment arm.
        const resizeObserver = new ResizeObserver(updateScrollState)
        resizeObserver.observe(scroller)
        return () => {
            scroller.removeEventListener("scroll", updateScrollState)
            resizeObserver.disconnect()
        }
    }, [updateScrollState])

    // Page by the visible width; mandatory snapping then lands the scroller
    // on the first card that wasn't fully in view.
    const scrollByPage = (direction: -1 | 1): void => {
        const scroller = scrollerRef.current
        if (!scroller) return
        scroller.scrollBy({
            left: direction * scroller.clientWidth,
            behavior: getPrefersReducedMotion() ? "auto" : "smooth",
        })
    }

    return (
        <div className={cx("latest-data-insights-grid", className)}>
            <ul className="latest-data-insights-grid__items" ref={scrollerRef}>
                {items.map((item) => (
                    <li
                        key={item.id}
                        className="latest-data-insights-grid__item"
                    >
                        <GridCard item={item} trackNote={trackNote} />
                    </li>
                ))}
                {/* Only shown on small screens, where the header's "See all"
                    button is hidden (see CSS). */}
                <li className="latest-data-insights-grid__item latest-data-insights-grid__item--see-all">
                    <Button
                        className="latest-data-insights-grid__see-all body-3-medium"
                        href={seeAllHref}
                        text={seeAllText}
                        theme="outline-vermillion"
                        dataTrackNote={trackNote && `${trackNote}_see_all`}
                    />
                </li>
            </ul>
            {canScrollPrev && (
                <Button
                    ariaLabel="Scroll to the previous data insights"
                    className="latest-data-insights-grid__control-button latest-data-insights-grid__control-button--prev"
                    theme="solid-blue"
                    onClick={() => scrollByPage(-1)}
                    icon={faChevronLeft}
                    text=""
                />
            )}
            {canScrollNext && (
                <Button
                    ariaLabel="Scroll to the next data insights"
                    className="latest-data-insights-grid__control-button latest-data-insights-grid__control-button--next"
                    theme="solid-blue"
                    onClick={() => scrollByPage(1)}
                    icon={faChevronRight}
                    text=""
                />
            )}
        </div>
    )
}

function GridCard({
    item,
    trackNote,
}: {
    item: LatestCarouselItem
    trackNote?: string
}) {
    const thumbnail = findThumbnailImageBlock(item.body)
    const thumbnailFilename = thumbnail?.smallFilename || thumbnail?.filename
    const thumbnailMetadata = useImage(thumbnailFilename)
    const isTallThumbnail =
        !!thumbnailMetadata?.originalWidth &&
        !!thumbnailMetadata.originalHeight &&
        thumbnailMetadata.originalHeight > thumbnailMetadata.originalWidth

    return (
        <a
            className="latest-data-insights-grid__card"
            href={item.href}
            data-track-note={trackNote}
        >
            {thumbnailFilename && (
                <Image
                    className={cx("latest-data-insights-grid__thumbnail", {
                        "latest-data-insights-grid__thumbnail--tall":
                            isTallThumbnail,
                    })}
                    filename={thumbnailFilename}
                    containerType="latest-data-insight-grid"
                    shouldLightbox={false}
                />
            )}
            {item.publishedAt && (
                <p
                    className="latest-data-insights-grid__date"
                    // Locale formatting may differ between the baker and the
                    // browser.
                    suppressHydrationWarning
                >
                    {formatDate(item.publishedAt)}
                </p>
            )}
            <h3 className="latest-data-insights-grid__title">{item.title}</h3>
        </a>
    )
}
