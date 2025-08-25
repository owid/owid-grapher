import { GrapherState, makeLabelForGrapherTab } from "@ourworldindata/grapher"
import { GRAPHER_TAB_NAMES, GrapherTabName } from "@ourworldindata/types"
import { findClosestTime } from "@ourworldindata/utils"
import { SearchChartHitThumbnail } from "./SearchChartHitThumbnail"
import { CaptionedLink } from "./SearchChartHitCaptionedLink"

export function CaptionedThumbnail({
    chartType,
    chartUrl,
    previewUrl,
    grapherState,
    className,
    onClick,
}: {
    chartType: GrapherTabName
    chartUrl: string
    previewUrl: string
    grapherState: GrapherState
    className?: string
    onClick?: () => void
}): React.ReactElement {
    let caption = makeLabelForGrapherTab(chartType, { format: "long" })

    // Add the map time to the caption if it's different from the chart's end time
    if (chartType === GRAPHER_TAB_NAMES.WorldMap) {
        const mapTime = grapherState.map.time
            ? findClosestTime(grapherState.times, grapherState.map.time)
            : undefined

        if (mapTime && mapTime !== grapherState.endTime) {
            const formattedMapTime =
                grapherState.table.timeColumn.formatTime(mapTime)
            caption += ` (${formattedMapTime})`
        }
    }

    return (
        <CaptionedLink
            caption={caption}
            url={chartUrl}
            className={className}
            onClick={onClick}
        >
            <SearchChartHitThumbnail previewUrl={previewUrl} />
        </CaptionedLink>
    )
}
