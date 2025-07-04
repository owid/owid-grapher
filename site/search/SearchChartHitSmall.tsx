import { useMemo } from "react"
import { Region } from "@ourworldindata/utils"
import { SearchChartHit, SearchIndexName } from "./searchTypes.js"
import { constructChartUrl, pickEntitiesForChartHit } from "./searchUtils.js"
import { HitAttributeHighlightResult } from "instantsearch.js"
import { getIndexName } from "./searchClient.js"
import { Highlight } from "react-instantsearch"
import { GrapherTabIcon } from "@ourworldindata/components"

export function SearchChartHitSmall({
    hit,
    searchQueryRegionsMatches,
    onClick,
}: {
    hit: SearchChartHit
    searchQueryRegionsMatches?: Region[] | undefined
    // Search uses a global onClick handler to track analytics
    // But the data catalog passes a function to this component explicitly
    onClick?: () => void
}) {
    const entities = useMemo(() => {
        const highlighted = (hit._highlightResult?.originalAvailableEntities ||
            hit._highlightResult?.availableEntities) as
            | HitAttributeHighlightResult[]
            | undefined
        const available = hit.originalAvailableEntities ?? hit.availableEntities

        return pickEntitiesForChartHit(
            highlighted,
            available,
            searchQueryRegionsMatches
        )
    }, [
        hit._highlightResult?.availableEntities,
        hit._highlightResult?.originalAvailableEntities,
        hit.availableEntities,
        hit.originalAvailableEntities,
        searchQueryRegionsMatches,
    ])

    const chartUrl = constructChartUrl({ hit, entities })

    return (
        <div className="search-chart-hit-small">
            <a
                href={chartUrl}
                className="search-chart-hit-small__title-link"
                onClick={onClick}
                data-algolia-index={getIndexName(
                    SearchIndexName.ExplorerViewsMdimViewsAndCharts
                )}
                data-algolia-object-id={hit.objectID}
                data-algolia-position={hit.__position}
            >
                <div className="search-chart-hit-small__header">
                    <div className="search-chart-hit-small__title-container">
                        <Highlight
                            attribute="title"
                            highlightedTagName="strong"
                            className="search-chart-hit-small__title"
                            hit={hit}
                        />
                        <span className="search-chart-hit-small__source">
                            {hit.source}
                        </span>
                    </div>
                    <div className="search-chart-hit-small__subtitle">
                        {hit.subtitle}
                    </div>
                </div>
            </a>
            <div className="search-chart-hit-small__tabs-container">
                {hit.availableTabs.map((tab) => (
                    <a
                        key={tab}
                        href={constructChartUrl({ hit, entities, tab })}
                        onClick={onClick}
                    >
                        <GrapherTabIcon tab={tab} />
                    </a>
                ))}
            </div>
        </div>
    )
}
