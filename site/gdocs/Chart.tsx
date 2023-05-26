import React, { useRef } from "react"
import { useEmbedChart } from "../hooks.js"
import {
    omitUndefinedValues,
    EnrichedBlockChart,
    Url,
} from "@ourworldindata/utils"
import { renderSpans } from "./utils.js"
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

    const url = Url.fromURL(d.url)
    const isExplorer = url.isExplorer
    const hasControls = url.queryParams.hideControls !== "true"
    const height = d.height || (isExplorer && hasControls ? 700 : 575)

    const chartConfig = omitUndefinedValues({
        title: d.title,
        subtitle: d.subtitle,
    })

    return (
        <div
            className={cx(d.position, className)}
            style={{ gridRow: d.row, gridColumn: d.column }}
            ref={refChartContainer}
        >
            <figure
                // Use unique `key` to force React to re-render tree
                key={d.url}
                data-grapher-src={isExplorer ? undefined : d.url}
                data-explorer-src={isExplorer ? d.url : undefined}
                data-grapher-config={
                    isExplorer ? undefined : JSON.stringify(chartConfig)
                }
                style={{
                    width: "100%",
                    border: "0px none",
                    height,
                }}
            />
            {d.caption ? (
                <figcaption>{renderSpans(d.caption)}</figcaption>
            ) : null}
        </div>
    )
}
