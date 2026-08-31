import { memo, useState, useCallback, useEffect, useRef } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faChevronRight,
    faChevronLeft,
} from "@fortawesome/free-solid-svg-icons"
import cx from "clsx"
import * as R from "remeda"

import { Button, getPrefersReducedMotion } from "@ourworldindata/components"
import { formatAuthors, OwidEnrichedGdocBlock } from "@ourworldindata/utils"
import { findThumbnailImageBlock } from "../../latest/latestUtils.js"
import Image from "./Image.js"
import { ArticleBlocks } from "./ArticleBlocks.js"
import DataInsightDateline from "./DataInsightDateline.js"

/** One card in a "Our latest …" carousel. Callers map their own content onto
 * this shape (see latestCarouselItems.ts) so the carousel itself doesn't know
 * whether it's showing data insights or announcements. */
export interface LatestCarouselItem {
    id: string
    title: string
    authors: string[]
    body: OwidEnrichedGdocBlock[]
    publishedAt?: Date
    href: string
}

export default function LatestCarousel({
    className,
    items,
    seeAllHref,
    seeAllText,
}: {
    className?: string
    items: LatestCarouselItem[]
    seeAllHref: string
    seeAllText: string
}) {
    const scrollerRef = useRef<HTMLUListElement>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)

    const updateSelectedIndex = useCallback(() => {
        const scroller = scrollerRef.current
        if (!scroller) return
        const cards = getVisibleCards(scroller)
        const maxScroll = scroller.scrollWidth - scroller.clientWidth
        if (cards.length === 0 || maxScroll <= 0) setSelectedIndex(0)
        else if (scroller.scrollLeft >= maxScroll - 1)
            // At the very end of the scroller the last card counts as
            // selected even though it can't reach its snap position.
            setSelectedIndex(cards.length - 1)
        else setSelectedIndex(findNearestCardIndex(cards, scroller.scrollLeft))
    }, [])

    useEffect(() => {
        const scroller = scrollerRef.current
        if (!scroller) return
        updateSelectedIndex()
        scroller.addEventListener("scroll", updateSelectedIndex, {
            passive: true,
        })
        window.addEventListener("resize", updateSelectedIndex)
        return () => {
            scroller.removeEventListener("scroll", updateSelectedIndex)
            window.removeEventListener("resize", updateSelectedIndex)
        }
    }, [updateSelectedIndex])

    // Since snapping is mandatory, the scroller always rests on a snap
    // position, so the selected index tells us whether there's room to
    // scroll. items.length - 1 is the last card reachable by the buttons: the
    // "See all" card beyond it only exists on small screens, where the buttons
    // are hidden.
    const canScrollPrev = selectedIndex > 0
    const canScrollNext = selectedIndex < items.length - 1

    const scrollToCard = (index: number): void => {
        const scroller = scrollerRef.current
        if (!scroller) return
        const cards = getVisibleCards(scroller)
        const card = cards[index]
        if (!card) return
        scroller.scrollTo({
            left: card.offsetLeft - cards[0].offsetLeft,
            behavior: getPrefersReducedMotion() ? "auto" : "smooth",
        })
    }

    return (
        <div className={cx("latest-carousel", className)}>
            <ul className="latest-carousel__card-container" ref={scrollerRef}>
                {items.map((item, index) => (
                    <CarouselCard
                        key={item.id}
                        index={index}
                        isSnapped={index === selectedIndex}
                        title={item.title}
                        authors={item.authors}
                        body={item.body}
                        publishedAt={item.publishedAt}
                        href={item.href}
                    />
                ))}
                {/* Only shown on small screens (see CSS). */}
                <li
                    className={cx(
                        "latest-carousel__card",
                        "latest-carousel__card--see-all",
                        {
                            "latest-carousel__card--snapped":
                                items.length === selectedIndex,
                        }
                    )}
                >
                    <Button
                        className="latest-carousel__card__see-all body-3-medium"
                        href={seeAllHref}
                        text={seeAllText}
                        theme="outline-vermillion"
                    />
                </li>
            </ul>
            {canScrollPrev && (
                <Button
                    ariaLabel="Scroll to the previous card"
                    className="latest-carousel__control-button latest-carousel__control-button--prev js--hide-if-js-disabled"
                    theme="solid-blue"
                    onClick={() => scrollToCard(selectedIndex - 1)}
                    icon={faChevronLeft}
                    text=""
                />
            )}
            {canScrollNext && (
                <Button
                    ariaLabel="Scroll to the next card"
                    className="latest-carousel__control-button latest-carousel__control-button--next js--hide-if-js-disabled"
                    theme="solid-blue"
                    onClick={() => scrollToCard(selectedIndex + 1)}
                    icon={faChevronRight}
                    text=""
                />
            )}
            {/* Without JS the dots would never update as the user scrolls. */}
            <div className="latest-carousel__dots js--hide-if-js-disabled">
                {/* The extra dot belongs to the "See all" card; it's hidden
                    along with its card on larger screens (see CSS). */}
                {Array.from({ length: items.length + 1 }, (_, index) => (
                    <div
                        key={index}
                        className={cx("latest-carousel__dot", {
                            "latest-carousel__dot--see-all":
                                index === items.length,
                            "latest-carousel__dot--selected":
                                index === selectedIndex,
                        })}
                    />
                ))}
            </div>
        </div>
    )
}

function getVisibleCards(scroller: HTMLElement): HTMLElement[] {
    return Array.from(scroller.children).filter(
        (card): card is HTMLElement =>
            card instanceof HTMLElement && card.offsetWidth > 0
    )
}

function findNearestCardIndex(
    cards: HTMLElement[],
    scrollLeft: number
): number {
    const origin = cards[0].offsetLeft
    const nearest = R.firstBy(
        cards.map((card, index) => ({ card, index })),
        ({ card }) => Math.abs(card.offsetLeft - origin - scrollLeft)
    )
    return nearest?.index ?? 0
}

const CarouselCard = memo(function CarouselCard({
    index,
    isSnapped,
    title,
    authors,
    body,
    publishedAt,
    href,
}: {
    index: number
    isSnapped: boolean
    title: string
    authors: string[]
    body: OwidEnrichedGdocBlock[]
    publishedAt?: Date
    href: string
}) {
    const titleId = `latest-carousel__card-title-${index}`
    const firstImageBlock = findThumbnailImageBlock(body)
    const otherBlocks = body.filter((block) => block !== firstImageBlock)
    return (
        <li
            className={cx("latest-carousel__card", {
                "latest-carousel__card--snapped": isSnapped,
            })}
        >
            <a
                className="latest-carousel__card__link"
                href={href}
                aria-labelledby={titleId}
            >
                {firstImageBlock && (
                    <Image
                        className="latest-carousel__card-left"
                        filename={
                            firstImageBlock.smallFilename ||
                            firstImageBlock.filename
                        }
                        containerType="latest-data-insight"
                        shouldLightbox={false}
                    />
                )}
                <div className="latest-carousel__card-right">
                    {publishedAt && (
                        <DataInsightDateline
                            className="latest-carousel__card-dateline"
                            publishedAt={publishedAt}
                            highlightToday={true}
                        />
                    )}
                    <h3 id={titleId} className="latest-carousel__card-title">
                        {title}
                    </h3>
                    <p className="latest-carousel__card-authors">
                        {formatAuthors(authors)}
                    </p>
                    <div className="latest-carousel__card-body">
                        <ArticleBlocks
                            blocks={otherBlocks}
                            containerType="data-insight"
                            shouldRenderLinks={false}
                        />
                    </div>
                    <div className="latest-carousel__card-continue">
                        <span className="body-3-medium-underlined">
                            Continue reading
                        </span>{" "}
                        <FontAwesomeIcon
                            icon={faArrowRight}
                            style={{ fontSize: "10px" }}
                        />
                    </div>
                </div>
            </a>
        </li>
    )
})
