import {
    EnrichedBlockChartRows,
    EnrichedChartRowItem,
} from "@ourworldindata/types"
import { useGuidedChartLinkHandler } from "@ourworldindata/grapher"
import cx from "classnames"
import ChartThumbnail from "./ChartThumbnail.js"
import Paragraph from "./Paragraph.js"

function ChartRow({ row }: { row: EnrichedChartRowItem }) {
    const onGuidedChartLinkClick = useGuidedChartLinkHandler()

    const thumbnail = (
        <ChartThumbnail image={row.image} containerType="chart-rows" />
    )

    const content = row.content.length > 0 && (
        <div className="chart-rows__row-content">
            {row.content.map((block, i) => (
                <Paragraph key={i} d={block} className="article-block__text" />
            ))}
        </div>
    )

    if (onGuidedChartLinkClick) {
        return (
            <div className="chart-rows__row">
                <button
                    className="chart-thumbnail"
                    onClick={() => onGuidedChartLinkClick(row.url)}
                    aria-label="Update chart to this view"
                >
                    {thumbnail}
                </button>
                {content}
            </div>
        )
    }

    return (
        <div className="chart-rows__row">
            <a href={row.url} className="chart-thumbnail">
                {thumbnail}
            </a>
            {content}
        </div>
    )
}

export default function ChartRows({
    d,
    className = "",
}: {
    d: EnrichedBlockChartRows
    className?: string
}) {
    const isInGuidedChart = !!useGuidedChartLinkHandler()

    return (
        <div
            className={cx(
                "chart-rows",
                isInGuidedChart && "chart-rows--guided",
                className
            )}
        >
            <p className="chart-rows__kicker">
                {d.kicker || "More views of this data"}
            </p>
            {!isInGuidedChart && d.title && (
                <h4 className="chart-rows__title">{d.title}</h4>
            )}
            <div className="chart-rows__rows-container">
                {d.rows.map((row, i) => (
                    <ChartRow key={i} row={row} />
                ))}
            </div>
            {!isInGuidedChart && d.source && (
                <p className="chart-rows__source">
                    <span className="chart-rows__source-label">
                        Data source:{" "}
                    </span>
                    {d.source}
                </p>
            )}
        </div>
    )
}
