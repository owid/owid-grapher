import { useMemo } from "react"
import { Region } from "@ourworldindata/utils"
import {
    ChartRecordType,
    SearchChartHit,
    SearchIndexName,
} from "./searchTypes.js"
import { getEntityQueryStr, pickEntitiesForChartHit } from "./searchUtils.js"
import { HitAttributeHighlightResult } from "instantsearch.js"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../../settings/clientSettings.js"
import { getIndexName } from "./searchClient.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faMapMarkerAlt } from "@fortawesome/free-solid-svg-icons"
import { Highlight } from "react-instantsearch"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { SearchAsDraft } from "./SearchAsDraft.js"

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
    const isExplorerView = hit.type === ChartRecordType.ExplorerView
    const isMultiDimView = hit.type === ChartRecordType.MultiDimView

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
    const entityQueryStr = useMemo(
        () => getEntityQueryStr(entities),
        [entities]
    )

    const fullQueryParams =
        isExplorerView || isMultiDimView
            ? hit.queryParams! + entityQueryStr.replace("?", "&")
            : entityQueryStr

    const chartUrl = isExplorerView
        ? `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${hit.slug}${fullQueryParams}`
        : `${BAKED_GRAPHER_URL}/${hit.slug}${fullQueryParams}`

    return (
        <SearchAsDraft
            name={`Chart (Small)`}
            className="search-chart-hit-small"
        >
            <div className="search-chart-hit-small__container">
                <div className="search-chart-hit-small__content">
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
                        <div className="search-chart-hit-small__title-container">
                            <Highlight
                                attribute="title"
                                highlightedTagName="strong"
                                className="search-chart-hit-small__title"
                                hit={hit}
                            />{" "}
                            <span className="search-chart-hit-small__variant">
                                {hit.variantName}
                            </span>
                        </div>
                    </a>
                    {entities.length > 0 && (
                        <ul className="search-chart-hit-small__entities">
                            {entities.map((entity, i) => (
                                <li
                                    key={entity}
                                    className="search-chart-hit-small__entity"
                                >
                                    {i === 0 && (
                                        <FontAwesomeIcon
                                            className="search-chart-hit-small__icon"
                                            icon={faMapMarkerAlt}
                                        />
                                    )}
                                    {entity}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </SearchAsDraft>
    )
}
