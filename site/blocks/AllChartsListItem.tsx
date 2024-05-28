import { BasicChartInformation } from "@ourworldindata/utils"
import React from "react"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"
import GrapherImage from "../GrapherImage.js"

export const AllChartsListItem = ({
    chart,
    onClick,
    isActive,
}: {
    chart: BasicChartInformation
    onClick: (e: React.MouseEvent) => void
    isActive: boolean
}) => {
    return (
        <li key={chart.slug} className={isActive ? "active" : ""}>
            <a
                href={`${BAKED_BASE_URL}/grapher/${chart.slug}`}
                onClick={onClick}
            >
                <GrapherImage slug={chart.slug} noFormatting />
                <span>{chart.title}</span>
            </a>
            {chart.variantName ? (
                <span className="variantName">{chart.variantName}</span>
            ) : null}
        </li>
    )
}
