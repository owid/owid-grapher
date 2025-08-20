import { GrapherState } from "@ourworldindata/grapher"
import { EntitySelectionMode } from "@ourworldindata/types"
import { runInAction } from "mobx"
import { buildChartHitDataTableContent } from "./SearchChartHitDataTableHelpers"
import { match } from "ts-pattern"
import { SearchChartHitDataTable } from "./SearchChartHitDataTable"
import { SearchChartHitDataPoints } from "./SearchChartHitDataPoints"
import { CaptionedLink } from "./SearchChartHitCaptionedLink"

export function CaptionedTable({
    chartUrl,
    grapherState,
    maxRows,
    className,
    onClick,
}: {
    chartUrl: string
    grapherState: GrapherState
    maxRows?: number
    className?: string
    onClick?: () => void
}): React.ReactElement | null {
    // Construct caption
    const numAvailableEntities =
        grapherState.addCountryMode === EntitySelectionMode.Disabled
            ? grapherState.transformedTable.availableEntityNames.length
            : grapherState.availableEntityNames.length
    const caption =
        numAvailableEntities === 1
            ? `Data available for ${numAvailableEntities} ${grapherState.entityType}`
            : `Data available for ${numAvailableEntities} ${grapherState.entityTypePlural}`

    const dataTableContent = runInAction(() =>
        buildChartHitDataTableContent({ grapherState, maxRows })
    )

    if (!dataTableContent) return null

    return (
        <CaptionedLink
            caption={caption}
            url={chartUrl}
            className={className}
            onClick={onClick}
        >
            <div className="search-chart-hit-table-wrapper">
                <div className="search-chart-hit-table-wrapper-content">
                    {match(dataTableContent)
                        .with({ type: "data-table" }, (content) => (
                            <SearchChartHitDataTable {...content.props} />
                        ))
                        .with({ type: "data-points" }, (content) => (
                            <SearchChartHitDataPoints {...content.props} />
                        ))
                        .exhaustive()}
                </div>
            </div>
        </CaptionedLink>
    )
}
