import React from "react"
import { useState, useRef } from "react"
import { OwidArticleBlock } from "./gdoc-types.js"
import { useEmbedChart } from "../hooks.js"

export default function Chart({ d }: { d: OwidArticleBlock }) {
    let content

    const refChartContainer = useRef<HTMLDivElement>(null)
    const [activeChartIdx, setActiveChartIdx] = useState(0)
    useEmbedChart(activeChartIdx, refChartContainer)

    if (typeof d.value === "string")
        content = (
            <figure
                // Use unique `key` to force React to re-render tree
                key={d.value}
                data-grapher-src={d.value}
                style={{
                    width: "100%",
                    height: "550px",
                    border: "0px none",
                }}
            />
        )
    else {
        // handle cases where url has been wrapped in an a tag
        if (d.value.url.startsWith("<a href=")) {
            const results = /<a [^>]+>(.*?)<\/a>/g.exec(d.value.url)
            if (results && results.length > 1) {
                d.value.url = results[1]
            }
        }

        content = (
            <figure
                className={d.value.position}
                style={{ gridRow: d.value.row, gridColumn: d.value.column }}
            >
                <figure
                    // Use unique `key` to force React to re-render tree
                    key={d.value.url}
                    data-grapher-src={d.value.url}
                    style={{
                        height:
                            d.value.position === "featured"
                                ? 700
                                : d.value.height || "550px",
                    }}
                />
                {d.value.caption ? (
                    <figcaption>{d.value.caption}</figcaption>
                ) : null}
            </figure>
        )
    }
    return content
}
