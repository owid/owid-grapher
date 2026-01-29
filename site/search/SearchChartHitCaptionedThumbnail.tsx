import { makeLabelForGrapherTab } from "@ourworldindata/grapher"
import { GrapherTabName } from "@ourworldindata/types"
import { SearchChartHitThumbnail } from "./SearchChartHitThumbnail"
import { CaptionedLink } from "./SearchChartHitCaptionedLink"
import { GrapherTabIcon } from "@ourworldindata/components"

export function CaptionedThumbnail({
    chartType,
    chartUrl,
    previewUrl,
    isSmallSlot = false,
    imageWidth,
    imageHeight,
    unit,
    className,
    onClick,
}: {
    chartType: GrapherTabName
    chartUrl: string
    previewUrl: string
    isSmallSlot?: boolean
    imageWidth?: number
    imageHeight?: number
    unit?: string
    className?: string
    onClick?: () => void
}): React.ReactElement {
    const caption = makeLabelForGrapherTab(chartType, { format: "long" })
    const hoverOverlayText = isSmallSlot ? "Explore" : "Click to explore"

    const captionWithIcon = (
        <span className="search-chart-hit-captioned-link-label-content">
            <GrapherTabIcon tab={chartType} />
            {caption}
            {unit && (
                <span className="search-chart-hit-captioned-link-label-unit">
                    {unit}
                </span>
            )}
        </span>
    )

    return (
        <CaptionedLink
            caption={captionWithIcon}
            url={chartUrl}
            className={className}
            onClick={onClick}
        >
            <SearchChartHitThumbnail
                previewUrl={previewUrl}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
                hoverOverlayText={hoverOverlayText}
            />
        </CaptionedLink>
    )
}
