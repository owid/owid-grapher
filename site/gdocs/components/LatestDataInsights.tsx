import { memo, useState, useCallback, useEffect, useMemo, useRef } from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faChevronRight,
    faChevronLeft,
} from "@fortawesome/free-solid-svg-icons"
import cx from "clsx"

import { Button } from "@ourworldindata/components"
import {
    EnrichedBlockImage,
    formatAuthors,
    OwidEnrichedGdocBlock,
    LatestDataInsight,
} from "@ourworldindata/utils"
import { buildLatestPagePath } from "../../latest/latestUtils.js"
import Image from "./Image.js"
import { ArticleBlocks } from "./ArticleBlocks.js"
import DataInsightDateline from "./DataInsightDateline.js"

export default function LatestDataInsights({
    className,
    latestDataInsights,
}: {
    className?: string
    latestDataInsights: LatestDataInsight[]
}) {
    const dataInsights = useMemo(
        () =>
            latestDataInsights.map((dataInsight) => {
                return {
                    ...dataInsight,
                    publishedAt: dataInsight.publishedAt
                        ? new Date(dataInsight.publishedAt)
                        : undefined,
                }
            }),
        [latestDataInsights]
    )
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
    // scroll. dataInsights.length - 1 is the last card reachable by the
    // buttons: the "See all" card beyond it only exists on small screens,
    // where the buttons are hidden.
    const canScrollPrev = selectedIndex > 0
    const canScrollNext = selectedIndex < dataInsights.length - 1

    const scrollToCard = (index: number): void => {
        const scroller = scrollerRef.current
        if (!scroller) return
        const cards = getVisibleCards(scroller)
        const card = cards[index]
        if (!card) return
        scroller.scrollTo({
            left: card.offsetLeft - cards[0].offsetLeft,
            behavior: "smooth",
        })
    }

    return (
        <div className={cx("latest-data-insights", className)}>
            <ul
                className="latest-data-insights__card-container"
                ref={scrollerRef}
            >
                {dataInsights.map((dataInsight, index) => (
                    <DataInsightCard
                        key={dataInsight.id}
                        index={index}
                        isSnapped={index === selectedIndex}
                        title={dataInsight.content.title}
                        authors={dataInsight.content.authors}
                        body={dataInsight.content.body}
                        publishedAt={dataInsight.publishedAt}
                        href={`/data-insights/${dataInsight.slug}`}
                    />
                ))}
                {/* Only shown on small screens (see CSS). */}
                <li
                    className={cx(
                        "latest-data-insights__card",
                        "latest-data-insights__card--see-all",
                        {
                            "latest-data-insights__card--snapped":
                                dataInsights.length === selectedIndex,
                        }
                    )}
                >
                    <Button
                        className="latest-data-insights__card__see-all body-3-medium"
                        href={buildLatestPagePath("data-insight")}
                        text="See all our Data Insights"
                        theme="outline-vermillion"
                    />
                </li>
            </ul>
            {canScrollPrev && (
                <Button
                    ariaLabel="Scroll to the previous data insight card"
                    className="latest-data-insights__control-button latest-data-insights__control-button--prev js--hide-if-js-disabled"
                    theme="solid-blue"
                    onClick={() => scrollToCard(selectedIndex - 1)}
                    icon={faChevronLeft}
                    text=""
                />
            )}
            {canScrollNext && (
                <Button
                    ariaLabel="Scroll to the next data insight card"
                    className="latest-data-insights__control-button latest-data-insights__control-button--next js--hide-if-js-disabled"
                    theme="solid-blue"
                    onClick={() => scrollToCard(selectedIndex + 1)}
                    icon={faChevronRight}
                    text=""
                />
            )}
            <div className="latest-data-insights__dots">
                {/* The extra dot belongs to the "See all" card; it's hidden
                    along with its card on larger screens (see CSS). */}
                {Array.from({ length: dataInsights.length + 1 }, (_, index) => (
                    <div
                        key={index}
                        className={cx("latest-data-insights__dot", {
                            "latest-data-insights__dot--see-all":
                                index === dataInsights.length,
                            "latest-data-insights__dot--selected":
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
    let nearestIndex = 0
    let nearestDistance = Infinity
    cards.forEach((card, index) => {
        const distance = Math.abs(card.offsetLeft - origin - scrollLeft)
        if (distance < nearestDistance) {
            nearestDistance = distance
            nearestIndex = index
        }
    })
    return nearestIndex
}

const DataInsightCard = memo(function DataInsightCard({
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
    const titleId = `latest-data-insights__card-title-${index}`
    const firstImageIndex = body.findIndex((block) => block.type === "image")
    const firstImageBlock = body[firstImageIndex] as
        | EnrichedBlockImage
        | undefined
    const otherBlocks = body.filter((_, index) => index !== firstImageIndex)
    return (
        <li
            className={cx("latest-data-insights__card", {
                "latest-data-insights__card--snapped": isSnapped,
            })}
        >
            <a
                className="latest-data-insights__card__data-insight"
                href={href}
                aria-labelledby={titleId}
            >
                {firstImageBlock && (
                    <Image
                        className="latest-data-insights__card-left"
                        filename={
                            firstImageBlock.smallFilename ||
                            firstImageBlock.filename
                        }
                        containerType="latest-data-insight"
                        shouldLightbox={false}
                    />
                )}
                <div className="latest-data-insights__card-right">
                    {publishedAt && (
                        <DataInsightDateline
                            className="latest-data-insights__card-dateline"
                            publishedAt={publishedAt}
                            highlightToday={true}
                        />
                    )}
                    <h3
                        id={titleId}
                        className="latest-data-insights__card-title"
                    >
                        {title}
                    </h3>
                    <p className="latest-data-insights__card-authors">
                        {formatAuthors(authors)}
                    </p>
                    <div className="latest-data-insights__card-body">
                        <ArticleBlocks
                            blocks={otherBlocks}
                            containerType="data-insight"
                            shouldRenderLinks={false}
                        />
                    </div>
                    <div className="latest-data-insights__card-continue">
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
