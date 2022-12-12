import React from "react"
import { useRef } from "react"
import { useEmbedChart } from "../hooks.js"
import { EnrichedBlockChart } from "@ourworldindata/utils"
import { renderSpans } from "./utils"
import { EXPLORERS_ROUTE_FOLDER } from "../../explorer/ExplorerConstants.js"
import cx from "classnames"

export default function Chart({
    d,
    className,
}: {
    d: EnrichedBlockChart
    className?: string
}) {
    const refChartContainer = useRef<HTMLDivElement>(null)
    useEmbedChart(0, refChartContainer)

    // handle cases where url has been wrapped in an a tag
    if (d.url.startsWith("<a href=")) {
        const results = /<a [^>]+>(.*?)<\/a>/g.exec(d.url)
        if (results && results.length > 1) {
            d.url = results[1]
        }
    }

    return (
        <figure
            className={cx(d.position, className)}
            style={{ gridRow: d.row, gridColumn: d.column }}
        >
            <figure
                // Use unique `key` to force React to re-render tree
                key={d.url}
                data-grapher-src={
                    d.url.includes(`/${EXPLORERS_ROUTE_FOLDER}/`)
                        ? undefined
                        : d.url
                }
                data-explorer-src={
                    d.url.includes(`/${EXPLORERS_ROUTE_FOLDER}/`)
                        ? d.url
                        : undefined
                }
                style={{
                    width: "100%",
                    border: "0px none",
                    height:
                        d.position === "featured" ? 700 : d.height || "550px",
                }}
            />
            {d.caption ? (
                <figcaption>{renderSpans(d.caption)}</figcaption>
            ) : null}
        </figure>
    )
}
