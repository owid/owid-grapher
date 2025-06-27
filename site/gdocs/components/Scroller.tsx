import { useState, useRef, useEffect, useCallback, useContext } from "react"
import { useIntersectionObserver } from "usehooks-ts"
import {
    EnrichedBlockScroller,
    EnrichedScrollerItem,
} from "@ourworldindata/utils"

import { useEmbedChart } from "../../hooks.js"
import SpanElements from "./SpanElements.js"
import cx from "classnames"
import { DocumentContext } from "../DocumentContext.js"

function ScrollerParagraph({
    value,
    index,
    onVisible,
}: {
    value: EnrichedScrollerItem
    index: number
    onVisible: (index: number, url: string) => void
}) {
    const { ref, isIntersecting } = useIntersectionObserver({
        threshold: 0.67,
    })

    useEffect(() => {
        if (isIntersecting) {
            onVisible(index, value.url)
        }
    }, [index, isIntersecting, onVisible, value.url])

    return (
        <div ref={ref} className="scroller__paragraph-intersection-wrapper">
            <p className="scroller__paragraph">
                <SpanElements spans={value.text.value} />
            </p>
        </div>
    )
}

export default function Scroller({
    d,
    className = "",
}: {
    d: EnrichedBlockScroller
    className?: string
}) {
    const [figureSrc, setFigureSrc] = useState(d.blocks[0].url)
    const refChartContainer = useRef<HTMLDivElement>(null)
    const { isPreviewing } = useContext(DocumentContext)

    const [activeChartIdx, setActiveChartIdx] = useState(0)
    useEmbedChart(activeChartIdx, refChartContainer, isPreviewing)

    const onVisible = useCallback(
        (index: number, url: string) => {
            setActiveChartIdx(index)
            setFigureSrc(url)
        },
        [setActiveChartIdx, setFigureSrc]
    )

    return (
        <section className={cx("scroller", className)}>
            <div className="scroller__paragraph-container span-cols-6 col-start-1 span-sm-cols-12">
                {d.blocks.map((value: EnrichedScrollerItem, i: number) => {
                    return (
                        <ScrollerParagraph
                            key={i}
                            value={value}
                            index={i}
                            onVisible={onVisible}
                        />
                    )
                })}
            </div>
            {figureSrc ? (
                <div
                    className="scroller__chart-container span-cols-6 col-start-7 span-sm-cols-12 col-sm-start-1"
                    ref={refChartContainer}
                >
                    <figure
                        // Use unique `key` to force React to re-render tree
                        // TODO: this as any cast should be removed - we don't know
                        // that figureSrc is going to be a string
                        className="scroller__chart"
                        key={figureSrc as any}
                        data-grapher-src={figureSrc}
                        style={{
                            width: "100%",
                            height: "550px",
                            border: "0px none",
                        }}
                    />
                </div>
            ) : null}
        </section>
    )
}
