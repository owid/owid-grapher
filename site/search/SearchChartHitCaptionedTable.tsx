import { match } from "ts-pattern"
import { SearchChartHitDataTable } from "./SearchChartHitDataTable"
import { SearchChartHitDataPoints } from "./SearchChartHitDataPoints"
import { CaptionedLink } from "./SearchChartHitCaptionedLink"
import { SearchChartHitDataTableContent } from "@ourworldindata/types"

export function CaptionedTable({
    chartUrl,
    dataTableContent,
    numAvailableEntities,
    entityType,
    entityTypePlural,
    className,
    onClick,
}: {
    chartUrl: string
    dataTableContent?: SearchChartHitDataTableContent
    numAvailableEntities: number
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
