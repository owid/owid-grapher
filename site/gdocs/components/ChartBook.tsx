import React, { useEffect, useRef, useState } from "react"
import cx from "classnames"
import {
    EnrichedBlockChartBook,
    EnrichedBlockKeyIndicator,
} from "@ourworldindata/types"
import { urlToSlug } from "@ourworldindata/utils"
import Chart from "./Chart.js"
import { useLinkedChart, useLinkedIndicator } from "../utils.js"

export default function ChartBook({
    d,
    className,
}: {
    d: EnrichedBlockChartBook
    className?: string
}) {
    const slugs = d.blocks.map((b: EnrichedBlockKeyIndicator) =>
        urlToSlug(b.datapageUrl)
    )

    const [isBlockOpen, setBlockOpen] = useState<boolean[]>(
        slugs.map((_: string, index: number) => index === 0) // the first block is open by default
    )

    return (
        <div className={cx("chart-book", className)}>
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
                            />
                        }
                    >
                        <KeyIndicatorContent block={block} />
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
                <div className="spacer" />
            </div>
        </div>
    )
}

function KeyIndicatorHeader({
    block,
    showMetadata = true,
}: {
    block: EnrichedBlockKeyIndicator
    showMetadata?: boolean
}) {
    const { linkedChart } = useLinkedChart(block.datapageUrl)
    const { linkedIndicator } = useLinkedIndicator(
        linkedChart?.indicatorId ?? 0
    )

    if (!linkedChart) return null
    if (!linkedIndicator) return null

    return (
        <div className="key-indicator-header grid grid-cols-12">
            <div
                className={cx("key-indicator-header__title", {
                    // TODO
                    "col-start-1 span-cols-4": true,
                    "col-start-1 span-cols-12": false,
                })}
            >
                {linkedIndicator.metadata?.presentation?.titlePublic}
            </div>
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
                {linkedIndicator.metadata?.origins?.[0].title ??
                    "Placeholder title"}{" "}
                | 1967-2021
            </div>
        </div>
    )
}

function KeyIndicatorContent({ block }: { block: EnrichedBlockKeyIndicator }) {
    const { linkedChart } = useLinkedChart(block.datapageUrl)
    const { linkedIndicator } = useLinkedIndicator(
        linkedChart?.indicatorId ?? 0
    )

    if (!linkedChart) return null
    if (!linkedIndicator) return null

    return (
        <div className="grid grid-cols-12">
            <div className="col-start-1 span-cols-4">
                <div className="metadata-table">
                    <div className="metadata-entry">
                        <div className="metadata-entry__title">Source</div>
                        <div className="metadata-entry__value">
                            {linkedIndicator.metadata?.origins?.[0].title ??
                                "Placeholder title"}
                        </div>
                    </div>
                    <div className="metadata-entry">
                        <div className="metadata-entry__title">Date range</div>
                        <div className="metadata-entry__value">1967-2021</div>
                    </div>
                    <div className="metadata-entry">
                        <div className="metadata-entry__title">
                            Last updated
                        </div>
                        <div className="metadata-entry__value">
                            May 25, 2022
                        </div>
                    </div>
                </div>
                <p className="body-3-medium" style={{ color: "#577291" }}>
                    {linkedIndicator.metadata?.description}
                </p>
            </div>
            <Chart
                className="col-start-5 span-cols-8 margin-0"
                d={{
                    url: block.datapageUrl,
                    type: "chart",
                    parseErrors: [],
                }}
            />
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
