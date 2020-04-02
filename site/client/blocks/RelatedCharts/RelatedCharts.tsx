import * as React from "react"
import ReactDOM = require("react-dom")
import { useState } from "react"

export interface RelatedChart {
    title: string
    slug: string
}

const RELATED_CHARTS_CLASS_NAME = "related-charts"

export const RelatedCharts = ({ charts }: { charts: RelatedChart[] }) => {
    const [currentChart, setCurrentChart] = useState<RelatedChart | null>(null)

    return (
        <div className={RELATED_CHARTS_CLASS_NAME}>
            <div className="wp-block-columns is-style-sticky-right">
                <div className="wp-block-column">
                    <ul>
                        {charts.map(chart => (
                            <li
                                className={
                                    (currentChart === null &&
                                        chart.slug === charts[0].slug) ||
                                    (currentChart &&
                                        currentChart.slug === chart.slug)
                                        ? "active"
                                        : ""
                                }
                                key={chart.slug}
                            >
                                <a
                                    href="#all-charts-preview"
                                    onClick={() =>
                                        setCurrentChart({
                                            title: chart.title,
                                            slug: chart.slug
                                        })
                                    }
                                >
                                    {chart.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="wp-block-column" id="all-charts-preview">
                    {currentChart ? (
                        <iframe
                            src={`/grapher/${currentChart.slug}`}
                            style={{
                                width: "100%",
                                height: "600px",
                                border: "0px none"
                            }}
                        ></iframe>
                    ) : (
                        // Taking advantage of the MultiEmbedder call in AdditionalInformation for
                        // first renders to prevent wrong chart width calculations due to collapsed
                        // height.
                        <figure
                            data-grapher-src={`/grapher/${charts[0].slug}`}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

export const runRelatedCharts = (charts: RelatedChart[]) => {
    const relatedChartsEl = document.querySelector<HTMLElement>(
        `.${RELATED_CHARTS_CLASS_NAME}`
    )
    if (relatedChartsEl) {
        const relatedChartsWrapper = relatedChartsEl.parentElement
        ReactDOM.hydrate(
            <RelatedCharts charts={charts} />,
            relatedChartsWrapper
        )
    }
}
