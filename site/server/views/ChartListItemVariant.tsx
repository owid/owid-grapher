import * as React from "react"
import { RelatedChart } from "../../client/blocks/RelatedCharts/RelatedCharts"

export const ChartListItemVariant = ({ chart }: { chart: RelatedChart }) => {
    return (
        <li>
            <a href={`/grapher/${chart.slug}`}>{chart.title}</a>
            {chart.variantName ? (
                <span className="variantName">{chart.variantName}</span>
            ) : null}
        </li>
    )
}
