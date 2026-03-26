import { EnrichedBlockSmallChart } from "@ourworldindata/types"
import { useGuidedChartLinkHandler } from "@ourworldindata/grapher"
import Image from "./Image.js"
import Paragraph from "./Paragraph.js"
import { getLayout } from "./layout.js"

function SmallChartRowItem({
    row,
    variant,
}: {
    row: EnrichedBlockSmallChart["rows"][number]
    variant: EnrichedBlockSmallChart["variant"]
}) {
    const onGuidedChartLinkClick = useGuidedChartLinkHandler()

    const thumbnail = (
        <Image
            filename={row.image}
            containerType="small-chart"
            shouldLightbox={false}
            shouldHideDownloadButton={true}
        />
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
        const alignClass = `small-chart--align-${d.align ?? "left"}`
        return (
            <div
                className={`small-chart small-chart--pull-quote ${alignClass} ${className}`}
            >
                <SmallChartRowItem row={row} variant={d.variant} />
            </div>
        )
    }

    return (
        <div className={`small-chart small-chart--rows ${className}`}>
            {d.title && <h4 className="small-chart__title">{d.title}</h4>}
            <div className="small-chart__rows-container">
                {d.rows.map((row, i) => (
                    <SmallChartRowItem key={i} row={row} variant={d.variant} />
                ))}
            </div>
        </div>
    )
}
