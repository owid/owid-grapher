import * as React from "react"
import { RelatedChart } from "../../../site/client/blocks/RelatedCharts/RelatedCharts"

export const ChartListItem = ({ chart }: { chart: RelatedChart }) => {
    return (
        <li key={chart.slug}>
            <a href={`/grapher/${chart.slug}`}>{chart.title}</a>
            {chart.variantName ? (
                <span className="variantName">{chart.variantName}</span>
            ) : null}
        </li>
    )
}
