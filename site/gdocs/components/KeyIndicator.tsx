import React from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"

import {
    EnrichedBlockKeyIndicator,
    EnrichedBlockText,
    LinkedIndicator,
} from "@ourworldindata/types"
import {
    makeDateRange,
    makeLastUpdated,
    SimpleMarkdownText,
} from "@ourworldindata/components"
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

    const source =
        d.source ||
        capitalize(
            joinTitleFragments(
                linkedIndicator.attributionShort,
                linkedIndicator.titleVariant
            )
        )

    return (
        <div className={cx("key-indicator grid grid-cols-12", className)}>
            <div className="left col-start-1 span-cols-4 span-sm-cols-12">
                <div className="indicator-title">
                    {linkedIndicator.title}{" "}
                    <span className="indicator-source">{source}</span>
                </div>
                {d.title || d.blurb ? (
                    <IndicatorNarrative block={d} />
                ) : (
                    <IndicatorMetadata linkedIndicator={linkedIndicator} />
                )}
                <a
                    className="datapage-link datapage-link-desktop"
                    href={d.datapageUrl}
                >
                    Explore and learn more about this data
                    <FontAwesomeIcon icon={faArrowRight} />
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
            </a>
        </div>
    )
}

function IndicatorNarrative({
    block,
}: {
    block: EnrichedBlockKeyIndicator
}): JSX.Element {
    return (
        <>
            {block.title && <h4 className="narrative-title">{block.title}</h4>}
            {block.blurb && (
                <div className="blurb">
                    {block.blurb.map(
                        (textBlock: EnrichedBlockText, i: number) => (
                            <Paragraph d={textBlock} key={i} />
                        )
                    )}
                </div>
            )}
        </>
    )
}

function IndicatorMetadata({
    linkedIndicator,
}: {
    linkedIndicator: LinkedIndicator
}): JSX.Element {
    const dateRange = makeDateRange({
        dateRange: linkedIndicator.dateRange,
    })
    const lastUpdated = makeLastUpdated({
        lastUpdated: linkedIndicator.lastUpdated,
    })

    return (
        <>
            {linkedIndicator.descriptionShort && (
                <div className="description">
                    <SimpleMarkdownText
                        text={linkedIndicator.descriptionShort}
                    />
                </div>
            )}
            <div className="metadata grid grid-cols-4">
                {dateRange && (
                    <div className="metadata-entry col-start-1 span-cols-2">
                        <div className="metadata-entry__title">Date range</div>
                        <div className="metadata-entry__value">{dateRange}</div>
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
        </>
    )
}
