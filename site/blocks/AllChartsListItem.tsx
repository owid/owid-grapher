import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
} from "@ourworldindata/grapher"
import { BasicChartInformation } from "@ourworldindata/utils"
import React from "react"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_EXPORTS_BASE_URL,
} from "../../settings/clientSettings.js"

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
                <img
                    src={`${BAKED_GRAPHER_EXPORTS_BASE_URL}/${chart.slug}.svg`}
                    loading="lazy"
                    data-no-lightbox
                    data-no-img-formatting
                    width={DEFAULT_GRAPHER_WIDTH}
                    height={DEFAULT_GRAPHER_HEIGHT}
                ></img>
                <span>{chart.title}</span>
            </a>
            {chart.variantName ? (
                <span className="variantName">{chart.variantName}</span>
            ) : null}
        </li>
    )
}
