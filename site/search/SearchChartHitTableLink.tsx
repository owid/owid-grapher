import { GrapherState } from "@ourworldindata/grapher"
import { runInAction } from "mobx"
import { buildChartHitDataTableContent } from "./SearchChartHitDataTableHelpers"
import { match } from "ts-pattern"
import { SearchChartHitDataTable } from "./SearchChartHitDataTable"
import { SearchChartHitDataPoints } from "./SearchChartHitDataPoints"
import { SearchChartHitOverlayLink } from "./SearchChartHitOverlayLink"

export function SearchChartHitTableLink({
    chartUrl,
    grapherState,
    maxRows,
    numRowsPerColumn,
    className,
    onClick,
}: {
    chartUrl: string
    grapherState: GrapherState
    maxRows?: number
    numRowsPerColumn?: number
    className?: string
    onClick?: () => void
}): React.ReactElement | null {
    const dataTableContent = runInAction(() =>
        buildChartHitDataTableContent({ grapherState, maxRows })
    )

    if (!dataTableContent) return null

    // Construct overlay text
    const numAvailableEntities = grapherState.availableEntityNames.length
    const overlay =
        numAvailableEntities === 1
            ? `Explore data for ${numAvailableEntities} ${grapherState.entityType}`
            : `Explore data for ${numAvailableEntities} ${grapherState.entityTypePlural}`

    return (
        <SearchChartHitOverlayLink
            className={className}
            url={chartUrl}
            overlay={overlay}
            onClick={onClick}
        >
            <div className="search-chart-hit-table-wrapper">
                <div className="search-chart-hit-table-wrapper-content">
                    {match(dataTableContent)
                        .with({ type: "data-table" }, (content) => (
                            <SearchChartHitDataTable
                                {...content.props}
                                numRowsPerColumn={numRowsPerColumn}
                            />
                        ))
                        .with({ type: "data-points" }, (content) => (
                            <SearchChartHitDataPoints {...content.props} />
                        ))
                        .exhaustive()}
                </div>
            </div>
        </SearchChartHitOverlayLink>
    )
}
