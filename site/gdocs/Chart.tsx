import React from "react"
import { useRef } from "react"
import { useEmbedChart } from "../hooks.js"
import { EnrichedBlockChart } from "@ourworldindata/utils"
import { renderSpans } from "./utils"
import { Url } from "@ourworldindata/utils"
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

    const isExplorer = Url.fromURL(d.url).isExplorer

    return (
        <figure
            className={cx(d.position, className)}
            style={{ gridRow: d.row, gridColumn: d.column }}
        >
            <figure
                // Use unique `key` to force React to re-render tree
                key={d.url}
                data-grapher-src={isExplorer ? undefined : d.url}
                data-explorer-src={isExplorer ? d.url : undefined}
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
