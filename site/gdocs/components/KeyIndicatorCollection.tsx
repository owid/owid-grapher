import React, { useEffect, useRef, useState } from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faArrowRight,
    faPlus,
    faEarthAmericas,
    faChartLine,
    faTable,
    IconDefinition,
} from "@fortawesome/free-solid-svg-icons"

import {
    EnrichedBlockKeyIndicatorCollection,
    EnrichedBlockKeyIndicator,
    GrapherTabOption,
} from "@ourworldindata/types"
import {
    Url,
    capitalize,
    joinTitleFragments,
    urlToSlug,
} from "@ourworldindata/utils"

import { useLinkedChart, useLinkedIndicator } from "../utils.js"
import KeyIndicator from "./KeyIndicator.js"

// keep in sync with $duration in KeyIndicatorCollection.scss
const HEIGHT_ANIMATION_DURATION_IN_SECONDS = 0.4

const tabIconMap: Record<GrapherTabOption, IconDefinition> = {
    [GrapherTabOption.chart]: faChartLine,
    [GrapherTabOption.map]: faEarthAmericas,
    [GrapherTabOption.table]: faTable,
}

export default function KeyIndicatorCollection({
    d,
    className,
}: {
    d: EnrichedBlockKeyIndicatorCollection
    className?: string
}) {
    const slugs = d.blocks.map((b: EnrichedBlockKeyIndicator) =>
        urlToSlug(b.datapageUrl)
    )

    const [isBlockOpen, setBlockOpen] = useState<boolean[]>(
        slugs.map((_: string, index: number) => index === 0) // the first block is open by default
    )

    return (
        <div className={cx("key-indicator-collection", className)}>
            {d.blocks.map(
                (block: EnrichedBlockKeyIndicator, blockIndex: number) => {
                    const isOpen = isBlockOpen[blockIndex]
                    const slug = urlToSlug(block.datapageUrl)

                    return (
                        <AccordionItem
                            // assumes a key indicator doesn't appear twice on a page
                            id={`key-indicator-collection_${slug}`}
                            key={slug}
                            isOpen={isOpen}
                            open={() => {
                                // open block, close all others
                                const updated = slugs.map(() => false)
                                updated[blockIndex] = true
                                setBlockOpen(updated)
                            }}
                            close={() => {
                                // close block, leave others as they are
                                const updated = [...isBlockOpen]
                                updated[blockIndex] = false
                                setBlockOpen(updated)
                            }}
                            header={
                                <KeyIndicatorHeader
                                    block={block}
                                    isContentVisible={isOpen}
                                />
                            }
                        >
                            <KeyIndicator d={block} />
                        </AccordionItem>
                    )
                }
            )}
        </div>
    )
}

function AccordionItem({
    id,
    isOpen,
    open,
    close,
    header,
    children,
}: {
    id: string
    isOpen: boolean
    open: () => void
    close: () => void
    header: React.ReactNode
    children: React.ReactNode
}) {
    const ref = useRef<HTMLDivElement>(null)
    const { ref: contentRef, height } = useHeight()

    const headerId = `${id}_header`
    const contentId = `${id}_content`

    return (
        <div
            ref={ref}
            className={cx("accordion-item", {
                "accordion-item--open": isOpen,
                "accordion-item--closed": !isOpen,
            })}
        >
            <h3>
                <button
                    id={headerId}
                    className="accordion-item__button"
                    onClick={() => {
                        if (isOpen) {
                            close()
                        } else {
                            open()

                            // scroll accordion item into view if it's not visible after opening
                            setTimeout(() => {
                                if (!ref.current) return
                                if (
                                    !isElementFullyVisible(ref.current) &&
                                    !isElementAtTopOfViewport(ref.current)
                                ) {
                                    ref.current.scrollIntoView({
                                        behavior: "smooth",
                                    })
                                }
                            }, HEIGHT_ANIMATION_DURATION_IN_SECONDS * 1000)
                        }
                    }}
                    disabled={isOpen}
                    aria-disabled={isOpen}
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                >
                    {header}
                </button>
            </h3>
            {!isOpen && (
                <a
                    className="accordion-item__link-mobile"
                    href="https://ourworldindata.org/grapher/life-expectancy"
                >
                    {header}
                </a>
            )}
            <div
                id={contentId}
                className="accordion-item__content"
                style={{
                    height: isOpen ? `${height}px` : "0px",
                }}
                role="region"
                aria-labelledby={headerId}
            >
                <div ref={contentRef}>{children}</div>
            </div>
        </div>
    )
}

function KeyIndicatorHeader({
    block,
    isContentVisible,
}: {
    block: EnrichedBlockKeyIndicator
    isContentVisible?: boolean
}) {
    const { linkedChart } = useLinkedChart(block.datapageUrl)
    const { linkedIndicator } = useLinkedIndicator(
        linkedChart?.indicatorId ?? 0
    )

    if (!linkedChart) return null
    if (!linkedIndicator) return null

    const { queryParams } = Url.fromURL(linkedChart.resolvedUrl)
    const tabFromQueryParams =
        queryParams.tab && isValidGrapherTab(queryParams.tab)
            ? queryParams.tab
            : undefined
    const activeTab =
        tabFromQueryParams || linkedChart.tab || GrapherTabOption.chart

    const source =
        block.source ||
        capitalize(
            joinTitleFragments(
                linkedIndicator.attributionShort,
                linkedIndicator.titleVariant
            )
        )

    return (
        <div
            className={cx("key-indicator-header", {
                "key-indicator-header--content-visible": isContentVisible,
            })}
        >
            <div>
                <FontAwesomeIcon
                    icon={tabIconMap[activeTab]}
                    className="key-indicator-header__tab-icon"
                />
                <span className="key-indicator-header__title">
                    {linkedIndicator.title}
                </span>
                {source && (
                    <span className="key-indicator-header__source">
                        {source}
                    </span>
                )}
            </div>
            {!isContentVisible && (
                <div>
                    {/* desktop */}
                    <FontAwesomeIcon
                        icon={faPlus}
                        className="key-indicator-header__icon"
                    />
                    {/* mobile */}
                    <FontAwesomeIcon
                        icon={faArrowRight}
                        className="key-indicator-header__icon"
                    />
                </div>
            )}
        </div>
    )
}

const useHeight = () => {
    const ref = useRef<HTMLDivElement>(null)

    const [height, setHeight] = useState(0)

    useEffect(() => {
        const element = ref.current as HTMLDivElement

        const resizeObserver = new ResizeObserver(
            (entries: ResizeObserverEntry[]) => {
                if (!Array.isArray(entries)) return
                if (entries.length === 0) return

                const entry = entries[0]
                setHeight(entry.target.scrollHeight)
            }
        )

        resizeObserver.observe(element)

        return () => resizeObserver.unobserve(element)
    }, [])

    return { ref, height }
}

function isElementFullyVisible(element: HTMLElement): boolean {
    const bbox = element.getBoundingClientRect()
    const viewHeight = Math.max(
        document.documentElement.clientHeight,
        window.innerHeight
    )
    return bbox.top >= 0 && bbox.bottom <= viewHeight
}

function isElementAtTopOfViewport(element: HTMLElement): boolean {
    const bbox = element.getBoundingClientRect()
    const viewHeight = Math.max(
        document.documentElement.clientHeight,
        window.innerHeight
    )
    return bbox.top >= 0 && bbox.top < 0.33 * viewHeight
}

function isValidGrapherTab(tab: string): tab is GrapherTabOption {
    return Object.values(GrapherTabOption).includes(tab as GrapherTabOption)
}
