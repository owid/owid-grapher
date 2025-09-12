import { makeLabelForGrapherTab } from "@ourworldindata/grapher"
import { GRAPHER_TAB_NAMES, GrapherTabName } from "@ourworldindata/types"
import { SearchChartHitThumbnail } from "./SearchChartHitThumbnail"
import { SearchChartHitOverlayLink } from "./SearchChartHitOverlayLink"

export function SearchChartHitThumbnailLink({
    chartType,
    chartUrl,
    previewUrl,
    imageWidth,
    imageHeight,
    className,
    onClick,
}: {
    chartType: GrapherTabName
    chartUrl: string
    previewUrl: string
    imageWidth?: number
    imageHeight?: number
    className?: string
    onClick?: () => void
}): React.ReactElement {
    const chartTypeLabel = makeLabelForGrapherTab(chartType, { format: "long" })
    const lowerCaseChartTypeLabel =
        chartType === GRAPHER_TAB_NAMES.Marimekko
            ? chartTypeLabel
            : chartTypeLabel.toLowerCase()

    return (
        <SearchChartHitOverlayLink
            className={className}
            url={chartUrl}
            overlay={`Explore interactive ${lowerCaseChartTypeLabel}`}
            onClick={onClick}
        >
            <SearchChartHitThumbnail
                previewUrl={previewUrl}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
            />
        </SearchChartHitOverlayLink>
    )
}
