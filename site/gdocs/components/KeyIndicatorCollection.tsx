import React, { useEffect, useRef, useState } from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faPlus } from "@fortawesome/free-solid-svg-icons"

import {
    EnrichedBlockKeyIndicatorCollection,
    EnrichedBlockKeyIndicator,
} from "@ourworldindata/types"
import {
    capitalize,
    joinTitleFragments,
    urlToSlug,
} from "@ourworldindata/utils"
import { makeDateRange } from "@ourworldindata/components"

import { useLinkedChart, useLinkedIndicator } from "../utils.js"
import KeyIndicator from "./KeyIndicator.js"

// keep in sync with $duration in KeyIndicatorCollection.scss
const HEIGHT_ANIMATION_DURATION_IN_SECONDS = 0.4

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
                            key={block.datapageUrl}
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
            className={cx("accordion-item", { "accordion-item--open": isOpen })}
        >
            <h3>
                <button
                    id={headerId}
                    className="accordion-item__header"
                    onClick={() => {
                        if (isOpen) {
                            close()
                        } else {
                            open()

                            // scroll accordion item into view
                            // after the animation has finished
                            // if it's not fully visible
                            setTimeout(() => {
                                if (!ref.current) return
                                if (!isElementFullyVisible(ref.current)) {
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

    const source = capitalize(
        joinTitleFragments(
            linkedIndicator.attributionShort,
            linkedIndicator.titleVariant
        )
    )
    const dateRange = makeDateRange({
        dateRange: linkedIndicator.dateRange,
    })

    return (
        <div
            className={cx("key-indicator-header grid grid-cols-12", {
                "key-indicator-header--content-visible": isContentVisible,
            })}
        >
            <div className="key-indicator-header__title col-start-1 span-cols-4 span-sm-cols-11">
                {linkedIndicator.title}
            </div>
            {(source || dateRange) && (
                <div
                    className={cx(
                        "key-indicator-header__metadata",
                        "col-start-5 span-cols-7",
                        {
                            visible: !isContentVisible,
                        }
                    )}
                    style={{ opacity: 0 }}
                >
                    {source}
                    {source && " | "}
                    {dateRange}
                </div>
            )}
            {!isContentVisible && (
                <div className="key-indicator-header__icon col-start-12 span-cols-1">
                    <FontAwesomeIcon icon={faPlus} />
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
