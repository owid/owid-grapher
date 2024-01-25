import React from "react"
import cx from "classnames"

import {
    EnrichedBlockKeyIndicator,
    EnrichedBlockText,
} from "@ourworldindata/types"
import {
    makeSource,
    makeDateRange,
    makeLastUpdated,
} from "@ourworldindata/components"

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

    const source = makeSource({
        attribution: linkedIndicator.attributionUnshortened,
        hideProcessingLevel: true,
    })
    const dateRange = makeDateRange({
        dateRange: linkedIndicator.dateRange,
    })
    const lastUpdated = makeLastUpdated({
        lastUpdated: linkedIndicator.lastUpdated,
    })

    return (
        <div className={cx("key-indicator grid grid-cols-12", className)}>
            <div className="col-start-1 span-cols-4">
                <div className="indicator-title">{linkedIndicator.title}</div>
                {d.title && <h3 className="narrative-title">{d.title}</h3>}
                {d.blurb && (
                    <div className="blurb">
                        {d.blurb.map(
                            (textBlock: EnrichedBlockText, i: number) => (
                                <Paragraph d={textBlock} key={i} />
                            )
                        )}
                    </div>
                )}
                <div
                    className={cx("metadata grid grid-cols-4", {
                        "metadata--border-top": d.title || d.blurb,
                    })}
                >
                    {source && (
                        <div className="metadata-entry col-start-1 span-cols-4">
                            <div className="metadata-entry__title">Source</div>
                            <div className="metadata-entry__value">
                                {source}
                            </div>
                        </div>
                    )}
                    {dateRange && (
                        <div className="metadata-entry col-start-1 span-cols-2">
                            <div className="metadata-entry__title">
                                Date range
                            </div>
                            <div className="metadata-entry__value">
                                {dateRange}
                            </div>
                        </div>
                    )}
                    {lastUpdated && (
                        <div
                            className={cx("metadata-entry", {
                                "col-start-3 span-cols-2": !!dateRange,
                                "col-start-1 span-cols-4": !dateRange,
                            })}
                        >
                            <div className="metadata-entry__title">
                                Last updated
                            </div>
                            <div className="metadata-entry__value">
                                {lastUpdated}
                            </div>
                        </div>
                    )}
                </div>
                <a className="datapage-link" href={d.datapageUrl}>
                    Explore and learn more about this data
                </a>
            </div>
            <Chart
                className="col-start-5 span-cols-8 margin-0"
                d={{ url: d.datapageUrl, type: "chart", parseErrors: [] }}
            />
        </div>
    )
}
