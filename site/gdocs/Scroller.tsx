import React, { useState, useRef } from "react"
import { InView } from "react-intersection-observer"
import { OwidArticleBlock } from "@ourworldindata/utils"

import { useEmbedChart } from "../hooks.js"

export default function Scroller({ d }: any) {
    let lastUrl: string
    const figureURLs = d.value.reduce(
        (memo: string[], { type, value }: OwidArticleBlock) => {
            if (type === "url") {
                lastUrl = value
            }
            if (type === "text") {
                memo = [...memo, lastUrl]
            }
            return memo
        },
        []
    )

    const [figureSrc, setFigureSrc] = useState(d.value[0].value)

    const refChartContainer = useRef<HTMLDivElement>(null)

    const [activeChartIdx, setActiveChartIdx] = useState(0)
    useEmbedChart(activeChartIdx, refChartContainer)

    return (
        <section className={"stickySection"}>
            {figureSrc ? (
                <div className={"stickyFigure"} ref={refChartContainer}>
                    <figure
                        // Use unique `key` to force React to re-render tree
                        key={figureSrc}
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
                {d.value
                    .filter((_d: OwidArticleBlock) => _d.type === "text")
                    .map(({ value }: OwidArticleBlock, i: number) => {
                        return (
                            <InView
                                key={i}
                                threshold={0.67}
                                onChange={(isVisible: boolean) => {
                                    if (isVisible) {
                                        setFigureSrc(figureURLs[i])
                                        setActiveChartIdx(i)
                                    }
                                }}
                            >
                                <p>{value}</p>
                            </InView>
                        )
                    })}
            </div>
        </section>
    )
}
