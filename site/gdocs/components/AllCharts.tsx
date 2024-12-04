import React, { useContext } from "react"
import cx from "classnames"
import {
    EnrichedBlockAllCharts,
    RelatedChart,
    Url,
    ALL_CHARTS_ID,
    KeyChartLevel,
} from "@ourworldindata/utils"
import { AttachmentsContext } from "../OwidGdoc.js"
import { RelatedCharts } from "../../blocks/RelatedCharts.js"

type AllChartsProps = EnrichedBlockAllCharts & {
    className?: string
}

function sortRelatedCharts(
    relatedCharts: RelatedChart[],
    sortedSlugs: string[]
): RelatedChart[] {
    const sortedRelatedCharts: RelatedChart[] = []

    // (We don't know if these slugs actually exist in relatedCharts)
    // Try to find them in order and put them at the front of the list
    sortedSlugs.forEach((slug) => {
        const index = relatedCharts.findIndex((chart) => chart.slug === slug)
        if (index !== -1) {
            const relatedChart = relatedCharts.splice(index, 1)[0]
            if (relatedChart) {
                // a teeny hack to stop the RelatedCharts component from
                // sorting these charts below the other key charts
                relatedChart.keyChartLevel = KeyChartLevel.Top
                sortedRelatedCharts.push(relatedChart)
            }
        }
    })

    sortedRelatedCharts.push(...relatedCharts)

    return sortedRelatedCharts
}

export function AllCharts(props: AllChartsProps) {
    const { heading, top, className } = props
    const { relatedCharts } = useContext(AttachmentsContext)
    const topSlugs = top.map((item) => Url.fromURL(item.url).slug as string)

    const sortedRelatedCharts = sortRelatedCharts(relatedCharts, topSlugs)
    return (
        <div className={cx(className)}>
            <h1
                className="article-block__heading h1-semibold"
                id={ALL_CHARTS_ID}
            >
                {heading}
                <a
                    className="deep-link"
                    aria-labelledby={ALL_CHARTS_ID}
                    href={`#${ALL_CHARTS_ID}`}
                />
            </h1>
            <RelatedCharts
                showKeyChartsOnly={true}
                charts={sortedRelatedCharts}
            />
        </div>
    )
}
