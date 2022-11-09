import React, { useState, useRef } from "react"
import { InView } from "react-intersection-observer"
import {
    EnrichedBlockScroller,
    EnrichedBlockText,
    OwidEnrichedArticleBlock,
} from "@ourworldindata/utils"

import { useEmbedChart } from "../hooks.js"
import { renderSpans } from "./utils"
import { EnrichedScrollerItem } from "@ourworldindata/utils/dist/owidTypes.js"
export default function Scroller({ d }: { d: EnrichedBlockScroller }) {
    let lastUrl: string

    const [figureSrc, setFigureSrc] = useState(d.blocks[0].url)

    const refChartContainer = useRef<HTMLDivElement>(null)

    const [activeChartIdx, setActiveChartIdx] = useState(0)
    useEmbedChart(activeChartIdx, refChartContainer)

    return (
        <section className={"stickySection"}>
            {figureSrc ? (
                <div className={"stickyFigure"} ref={refChartContainer}>
                    <figure
                        // Use unique `key` to force React to re-render tree
                        // TODO: this as any cast should be removed - we don't know
                        // that figureSrc is going to be a string
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
            <div className={"stickyContent"}>
                {d.blocks.map((value: EnrichedScrollerItem, i: number) => {
                    return (
                        <InView
                            key={i}
                            threshold={0.67}
                            onChange={(isVisible: boolean) => {
                                if (isVisible) {
                                    setFigureSrc(value.url)
                                    setActiveChartIdx(i)
                                }
                            }}
                        >
                            <p>{renderSpans(value.text.value)}</p>
                        </InView>
                    )
                })}
            </div>
        </section>
    )
}
