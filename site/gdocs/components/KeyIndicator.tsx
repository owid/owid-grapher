import React from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"

import {
    EnrichedBlockKeyIndicator,
    EnrichedBlockText,
} from "@ourworldindata/types"
import { makeDateRange, makeLastUpdated } from "@ourworldindata/components"
import { capitalize, joinTitleFragments } from "@ourworldindata/utils"

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

    const source = capitalize(
        joinTitleFragments(
            linkedIndicator.attributionShort,
            linkedIndicator.titleVariant
        )
    )
    const dateRange = makeDateRange({
        dateRange: linkedIndicator.dateRange,
    })
    const lastUpdated = makeLastUpdated({
        lastUpdated: linkedIndicator.lastUpdated,
    })

    return (
        <div className={cx("key-indicator grid grid-cols-12", className)}>
            <div className="col-start-1 span-cols-4 span-sm-cols-12">
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
                {linkedIndicator.descriptionShort && (
                    <p className="description">
                        {linkedIndicator.descriptionShort}
                    </p>
                )}
                <a
                    className="datapage-link datapage-link-desktop"
                    href={d.datapageUrl}
                >
                    Explore and learn more about this data
                </a>
            </div>
            <Chart
                className="col-start-5 span-cols-8 span-sm-cols-12 margin-0"
                d={{ url: d.datapageUrl, type: "chart", parseErrors: [] }}
                shouldOptimizeForHorizontalSpace={false}
            />
            <a
                className="datapage-link datapage-link-mobile col-start-1 span-cols-12"
                href={d.datapageUrl}
            >
                Explore and learn more about this data
                <FontAwesomeIcon icon={faArrowRight} />
            </a>
        </div>
    )
}
