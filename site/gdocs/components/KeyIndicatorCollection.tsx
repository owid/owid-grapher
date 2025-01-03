import { useContext, useEffect, useRef, useState } from "react"
import * as React from "react"
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
    GRAPHER_TAB_OPTIONS,
    GrapherTabOption,
} from "@ourworldindata/types"
import { Url, urlToSlug, commafyNumber } from "@ourworldindata/utils"

import { useLinkedChart, useLinkedIndicator } from "../utils.js"
import KeyIndicator from "./KeyIndicator.js"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { Button } from "@ourworldindata/components"

// keep in sync with $duration in KeyIndicatorCollection.scss
const HEIGHT_ANIMATION_DURATION_IN_SECONDS = 0.4

const tabIconMap: Record<GrapherTabOption, IconDefinition> = {
    [GRAPHER_TAB_OPTIONS.chart]: faChartLine,
    [GRAPHER_TAB_OPTIONS.map]: faEarthAmericas,
    [GRAPHER_TAB_OPTIONS.table]: faTable,
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

    const { homepageMetadata } = useContext(AttachmentsContext)

    const { blocks } = d
    return (
        <section className={cx("key-indicator-collection", className)}>
            <header className="key-indicator-collection__header span-cols-8 span-sm-cols-12">
                <h2 className="h2-bold">Explore our data</h2>
                {homepageMetadata?.chartCount ? (
                    <p className="body-2-regular">
                        Featured data from our collection of{" "}
                        {commafyNumber(homepageMetadata.chartCount)} interactive
                        charts.
                    </p>
                ) : (
                    <p className="body-2-regular">
                        Featured data from our collection
                    </p>
                )}
            </header>
            <Button
                href="/data"
                className="key-indicator-collection__all-charts-button body-3-medium span-cols-4 col-start-9 col-sm-start-1 span-sm-cols-12"
                text="See all our data"
                theme="outline-vermillion"
            />
            <div className="span-cols-12">
                {blocks.map(
                    (block: EnrichedBlockKeyIndicator, blockIndex: number) => {
                        const slug = slugs[blockIndex]
                        const isOpen = isBlockOpen[blockIndex]

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
                                mobileHeader={
                                    <KeyIndicatorLink block={block}>
                                        <KeyIndicatorHeader
                                            block={block}
                                            isContentVisible={isOpen}
                                        />
                                    </KeyIndicatorLink>
                                }
                            >
                                <KeyIndicator d={block} />
                            </AccordionItem>
                        )
                    }
                )}
            </div>
        </section>
    )
}

function AccordionItem({
    id,
    isOpen,
    open,
    close,
    header,
    mobileHeader,
    children,
}: {
    id: string
    isOpen: boolean
    open: () => void
    close: () => void
    header: React.ReactNode
    mobileHeader: React.ReactNode
    children: React.ReactNode
}) {
    const ref = useRef<HTMLDivElement>(null)
    const { ref: contentRef, height } = useHeight()

    const headerId = `${id}_header`
    const contentId = `${id}_content`

    // remove content from the tab sequence if it's not visible
    useEffect(() => {
        if (!contentRef.current) return
        contentRef.current.inert = !isOpen
    }, [isOpen, contentRef])

    const contentHeight = isOpen ? height : 0

    return (
        <div
            ref={ref}
            className={cx("accordion-item", {
                "accordion-item--open": isOpen,
                "accordion-item--closed": !isOpen,
            })}
        >
            {/* desktop */}
            <h3 className="accordion-item__heading">
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

                                // focus on content after the scroll-into-view
                                // animation has finished (fixes a bug in Safari
                                // where focus is lost after an accordion item
                                // is opened and the focus unexpectedly jumps
                                // to the top of the page on further interactions)
                                setTimeout(() => {
                                    if (contentRef.current) {
                                        contentRef.current.focus()
                                    }
                                }, 600)
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
            {/* mobile */}
            {!isOpen && mobileHeader}
            <div
                id={contentId}
                className="accordion-item__content"
                style={{
                    height: contentHeight,
                }}
                role="region"
                aria-labelledby={headerId}
            >
                <div
                    ref={contentRef}
                    tabIndex={isOpen ? 0 : -1}
                    aria-hidden={!isOpen}
                >
                    {children}
                </div>
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
        tabFromQueryParams || linkedChart.tab || GRAPHER_TAB_OPTIONS.chart

    const source = block.source || linkedIndicator.attributionShort

    return (
        <div className="key-indicator-header">
            <div className="key-indicator-header__left">
                <FontAwesomeIcon
                    icon={tabIconMap[activeTab]}
                    className="key-indicator-header__tab-icon"
                />
                <div>
                    <span className="key-indicator-header__title">
                        {linkedIndicator.title}
                    </span>
                    {source && (
                        <span className="key-indicator-header__source">
                            {source}
                        </span>
                    )}
                </div>
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

function KeyIndicatorLink({
    block,
    children,
}: {
    block: EnrichedBlockKeyIndicator
    children: React.ReactNode
}) {
    const { linkedChart } = useLinkedChart(block.datapageUrl)
    const { linkedIndicator } = useLinkedIndicator(
        linkedChart?.indicatorId ?? 0
    )

    if (!linkedChart) return null
    if (!linkedIndicator) return null

    return (
        <a
            className="accordion-item__link-mobile"
            href={linkedChart.resolvedUrl}
        >
            {children}
        </a>
    )
}

const useHeight = () => {
    const ref = useRef<HTMLDivElement>(null)

    const [height, setHeight] = useState<number | undefined>(undefined)

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
    return Object.values(GRAPHER_TAB_OPTIONS).includes(tab as GrapherTabOption)
}
