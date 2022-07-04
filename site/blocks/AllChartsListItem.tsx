import React from "react"
import { RelatedChart } from "../../clientUtils/owidTypes.js"
import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
} from "../../grapher/core/GrapherConstants.js"
import { BAKED_GRAPHER_EXPORTS_BASE_URL } from "../../settings/clientSettings.js"

export const AllChartsListItem = ({
    chart,
    onClick,
}: {
    chart: RelatedChart
    onClick: (e: React.MouseEvent) => void
}) => {
    return (
        <li key={chart.slug}>
            <a href={`/grapher/${chart.slug}`} onClick={onClick}>
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
