import React, { useState, useRef } from "react"
import { InView } from "react-intersection-observer"
import {
    EnrichedBlockScroller,
    EnrichedScrollerItem,
} from "@ourworldindata/utils"

import { useEmbedChart } from "../hooks.js"
import { renderSpans } from "./utils.js"
import cx from "classnames"
export default function Scroller({
    d,
    className = "",
}: {
    d: EnrichedBlockScroller
    className?: string
}) {
    const [figureSrc, setFigureSrc] = useState(d.blocks[0].url)

    const refChartContainer = useRef<HTMLDivElement>(null)

    const [activeChartIdx, setActiveChartIdx] = useState(0)
    useEmbedChart(activeChartIdx, refChartContainer)

    return (
        <section className={cx("scroller", className)}>
            <div className="scroller__paragraph-container span-cols-6 col-start-1 span-sm-cols-12">
                {d.blocks.map((value: EnrichedScrollerItem, i: number) => {
                    return (
                        <InView
                            key={i}
                            className="scroller__paragraph-intersection-wrapper"
                            threshold={0.67}
                            onChange={(isVisible: boolean) => {
                                if (isVisible) {
                                    setFigureSrc(value.url)
                                    setActiveChartIdx(i)
                                }
                            }}
                        >
                            <p className="scroller__paragraph">
                                {renderSpans(value.text.value)}
                            </p>
                        </InView>
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
