import React from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"

import {
    EnrichedBlockKeyIndicator,
    EnrichedBlockText,
} from "@ourworldindata/types"
import { capitalize } from "@ourworldindata/utils"

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

    const source = capitalize(d.source || linkedIndicator.attributionShort)

    return (
        <div className={cx("key-indicator grid grid-cols-12", className)}>
            <div className="left col-start-1 span-cols-4 span-sm-cols-12">
                <div className="indicator-metadata">
                    <span className="indicator-title">
                        {linkedIndicator.title}
                    </span>{" "}
                    <span className="indicator-source">{source}</span>
                </div>
                <h4 className="narrative-title">{d.title}</h4>
                <div className="text">
                    {d.text.map((textBlock: EnrichedBlockText, i: number) => (
                        <Paragraph d={textBlock} key={i} />
                    ))}
                </div>
                <a
                    className="datapage-link datapage-link-desktop"
                    href={linkedChart.resolvedUrl}
                >
                    Explore and learn more about this data
                    <FontAwesomeIcon icon={faArrowRight} />
                </a>
            </div>
            <Chart
                className="key-indicator-chart col-start-5 span-cols-8 span-sm-cols-12 margin-0"
                d={{
                    url: linkedChart.resolvedUrl,
                    type: "chart",
                    parseErrors: [],
                }}
                shouldOptimizeForHorizontalSpace={false}
            />
            <a
                className="datapage-link datapage-link-mobile col-start-1 span-cols-12"
                href={linkedChart.resolvedUrl}
            >
                Explore and learn more about this data
            </a>
        </div>
    )
}
