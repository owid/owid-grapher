import React from "react"
import { EnrichedBlockKeyIndicator } from "@ourworldindata/types"
import Chart from "./Chart.js"
import Paragraph from "./Paragraph.js"
import { useLinkedChart, useLinkedIndicator } from "../utils.js"

export default function KeyIndicator({
    d,
    className,
}: {
    d: EnrichedBlockKeyIndicator
    className?: string
}) {
    const { linkedChart } = useLinkedChart(d.datapageUrl)
    const { linkedIndicator } = useLinkedIndicator(
        linkedChart?.indicatorId ?? 0
    )

    if (!linkedChart) return null
    if (!linkedIndicator) return null

    return (
        <div className={className} style={{ border: "solid gray" }}>
            <div>
                <b>Custom title:</b> {d.title}
            </div>
            <div>
                <b>Default title:</b> {linkedChart?.title}
            </div>
            {d.blurb && (
                <div>
                    <b>Blurb:</b>
                    {d.blurb.map((textBlock, i) => (
                        <Paragraph d={textBlock} key={i} />
                    ))}
                </div>
            )}
            <Chart
                className="margin-0"
                d={{ url: d.datapageUrl, type: "chart", parseErrors: [] }}
            />
            <div>
                <b>Linked indicator with metadata:</b>
                <code>{JSON.stringify(linkedIndicator, null, 2)}</code>
            </div>
        </div>
    )
}
