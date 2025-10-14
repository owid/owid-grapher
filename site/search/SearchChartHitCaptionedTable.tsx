import { SearchChartHitDataTable } from "./SearchChartHitDataTable"
import {
    CaptionedLink,
    CaptionedLinkOverlay,
} from "./SearchChartHitCaptionedLink"
import {
    GRAPHER_TAB_NAMES,
    SearchChartHitDataTableProps,
} from "@ourworldindata/types"
import { GrapherTabIcon } from "@ourworldindata/components"

export function CaptionedTable({
    chartUrl,
    dataTableContent,
    numAvailableEntities,
    numRowsPerColumn,
    entityType,
    entityTypePlural,
    className,
    onClick,
}: {
    chartUrl: string
    dataTableContent?: SearchChartHitDataTableProps
    numAvailableEntities: number
    numRowsPerColumn?: number
    entityType: string
    entityTypePlural: string
    className?: string
    onClick?: () => void
}): React.ReactElement | null {
    if (!dataTableContent) return null

    const caption =
        numAvailableEntities === 1
            ? `Data available for ${numAvailableEntities} ${entityType}`
            : `Data available for ${numAvailableEntities} ${entityTypePlural}`

    const captionWithIcon = (
        <span className="search-chart-hit-captioned-link-label-content">
            <GrapherTabIcon tab={GRAPHER_TAB_NAMES.Table} />
            {caption}
        </span>
    )

    return (
        <CaptionedLink
            caption={captionWithIcon}
            url={chartUrl}
            className={className}
            onClick={onClick}
        >
            <div className="search-chart-hit-table-wrapper">
                <div className="search-chart-hit-table-wrapper-content">
                    <SearchChartHitDataTable
                        {...dataTableContent}
                        numRowsPerColumn={numRowsPerColumn}
                    />
                </div>
                <CaptionedLinkOverlay>Click to explore</CaptionedLinkOverlay>
            </div>
        </CaptionedLink>
    )
}
