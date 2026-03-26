import { EnrichedBlockSmallChart } from "@ourworldindata/types"
import { useGuidedChartLinkHandler } from "@ourworldindata/grapher"
import Image from "./Image.js"
import Paragraph from "./Paragraph.js"
import { getLayout } from "./layout.js"

function SmallChartRowItem({
    row,
}: {
    row: EnrichedBlockSmallChart["rows"][number]
}) {
    const onGuidedChartLinkClick = useGuidedChartLinkHandler()

    const thumbnailImage = (
        <Image
            filename={row.image}
            containerType="small-chart"
            shouldLightbox={false}
            shouldHideDownloadButton={true}
        />
    )

    const thumbnail = (
        <>
            {thumbnailImage}
            <div className="small-chart__overlay">
                <div className="small-chart__cta">Click to explore</div>
            </div>
        </>
    )

    const content = row.content.length > 0 && (
        <div className="small-chart__content">
            {row.content.map((block, i) => (
                <Paragraph key={i} d={block} className={getLayout("text")} />
            ))}
        </div>
    )

    if (onGuidedChartLinkClick) {
        return (
            <div className="small-chart__row-item">
                <button
                    className="small-chart__thumbnail-button"
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
        <div className="small-chart__row-item">
            <a href={row.url} className="small-chart__thumbnail-link">
                {thumbnail}
            </a>
            {content}
        </div>
    )
}

export default function SmallChart({
    d,
    className = "",
}: {
    d: EnrichedBlockSmallChart
    className?: string
}) {
    if (d.variant === "pull-quote") {
        const row = d.rows[0]
        if (!row) return null
        const alignClass = `small-chart--align-${d.align ?? "left-center"}`
        return (
            <div
                className={`small-chart small-chart--pull-quote ${alignClass} ${className}`}
            >
                <SmallChartRowItem row={row} />
            </div>
        )
    }

    return (
        <div className={`small-chart small-chart--rows ${className}`}>
            {d.kicker && <p className="small-chart__kicker">{d.kicker}</p>}
            {d.title && <h4 className="small-chart__title">{d.title}</h4>}
            <div className="small-chart__rows-container">
                {d.rows.map((row, i) => (
                    <SmallChartRowItem key={i} row={row} />
                ))}
            </div>
            {d.source && (
                <p className="small-chart__source">
                    <strong>Data source: </strong>
                    {d.source}
                </p>
            )}
        </div>
    )
}
