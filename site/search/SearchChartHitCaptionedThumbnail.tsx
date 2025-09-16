import { makeLabelForGrapherTab } from "@ourworldindata/grapher"
import { GrapherTabName } from "@ourworldindata/types"
import { SearchChartHitThumbnail } from "./SearchChartHitThumbnail"
import { CaptionedLink } from "./SearchChartHitCaptionedLink"

export function CaptionedThumbnail({
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
    const caption = makeLabelForGrapherTab(chartType, { format: "long" })

    return (
        <CaptionedLink
            caption={caption}
            url={chartUrl}
            className={className}
            onClick={onClick}
        >
            <SearchChartHitThumbnail
                previewUrl={previewUrl}
                imageWidth={imageWidth}
                imageHeight={imageHeight}
            />
        </CaptionedLink>
    )
}
