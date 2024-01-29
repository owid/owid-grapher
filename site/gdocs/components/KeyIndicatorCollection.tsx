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
                (block: EnrichedBlockKeyIndicator, blockIndex: number) => (
                    <AccordionItem
                        key={block.datapageUrl}
                        isOpen={isBlockOpen[blockIndex]}
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
                                showMetadata={!isBlockOpen[blockIndex]}
                                showIcon={!isBlockOpen[blockIndex]}
                            />
                        }
                    >
                        <KeyIndicator d={block} />
                    </AccordionItem>
                )
            )}
        </div>
    )
}

function AccordionItem({
    isOpen,
    open,
    close,
    header,
    children,
}: {
    isOpen: boolean
    open: () => void
    close: () => void
    header: React.ReactNode
    children: React.ReactNode
}) {
    const { ref, height } = useHeight()

    return (
        <div className="accordion-item">
            <button
                className="accordion-item__header"
                onClick={() => {
                    if (isOpen) {
                        close()
                    } else {
                        open()
                    }
                }}
                disabled={isOpen}
            >
                {header}
            </button>
            <div
                ref={ref}
                className="accordion-item__content"
                style={{
                    height: isOpen ? `${height}px` : "0px",
                }}
            >
                {children}
            </div>
        </div>
    )
}

function KeyIndicatorHeader({
    block,
    showMetadata = true,
    showIcon = false,
}: {
    block: EnrichedBlockKeyIndicator
    showMetadata?: boolean
    showIcon?: boolean
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
        <div className="key-indicator-header grid grid-cols-12">
            <div className="key-indicator-header__title col-start-1 span-cols-4 span-sm-cols-11">
                {linkedIndicator.title}
            </div>
            {(source || dateRange) && (
                <div
                    className={cx(
                        "key-indicator-header__metadata",
                        "col-start-5 span-cols-8",
                        {
                            visible: showMetadata,
                        }
                    )}
                    style={{ opacity: 0 }}
                >
                    {source}
                    {source && " | "}
                    {dateRange}
                </div>
            )}
            {showIcon && (
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
