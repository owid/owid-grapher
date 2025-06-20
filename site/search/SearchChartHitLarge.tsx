import { useEffect, useMemo, useState } from "react"
import cx from "classnames"
import { Region } from "@ourworldindata/utils"
import {
    ChartRecordType,
    IDataCatalogHit,
    SearchIndexName,
} from "./searchTypes.js"
import { getEntityQueryStr, pickEntitiesForChartHit } from "./searchUtils.js"
import { HitAttributeHighlightResult } from "instantsearch.js"
import {
    BAKED_BASE_URL,
    BAKED_GRAPHER_URL,
    EXPLORER_DYNAMIC_THUMBNAIL_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../../settings/clientSettings.js"
import { getIndexName } from "./searchClient.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faHeartBroken,
    faMapMarkerAlt,
} from "@fortawesome/free-solid-svg-icons"
import {
    DEFAULT_GRAPHER_HEIGHT,
    DEFAULT_GRAPHER_WIDTH,
} from "@ourworldindata/grapher"
import { Highlight } from "react-instantsearch"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"
import { SearchAsDraft } from "./SearchAsDraft.js"

export function SearchChartHitLarge({
    hit,
    searchQueryRegionsMatches,
    onClick,
}: {
    hit: IDataCatalogHit
    searchQueryRegionsMatches?: Region[] | undefined
    // Search uses a global onClick handler to track analytics
    // But the data catalog passes a function to this component explicitly
    onClick?: () => void
}) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const [imgError, setImgError] = useState(false)
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

    function createExplorerViewThumbnailUrl(
        slug: string,
        fullQueryParams: string
    ): string {
        return `${EXPLORER_DYNAMIC_THUMBNAIL_URL}/${slug}.png${fullQueryParams}`
    }
    function createGrapherThumbnailUrl(
        slug: string,
        fullQueryParams = ""
    ): string {
        return `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${slug}.png${fullQueryParams}`
    }
    const previewUrl = isExplorerView
        ? createExplorerViewThumbnailUrl(hit.slug, fullQueryParams)
        : createGrapherThumbnailUrl(hit.slug, fullQueryParams)

    const chartUrl = isExplorerView
        ? `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${hit.slug}${fullQueryParams}`
        : `${BAKED_GRAPHER_URL}/${hit.slug}${fullQueryParams}`

    useEffect(() => {
        setImgLoaded(false)
        setImgError(false)
    }, [previewUrl])

    return (
        <SearchAsDraft name="Chart (Large)" className="search-chart-hit-large">
            <div className="search-chart-hit-large__container">
                <div className="search-chart-hit-large__content">
                    <div className="search-chart-hit-large__title-container">
                        <Highlight
                            attribute="title"
                            highlightedTagName="strong"
                            className="search-chart-hit-large__title"
                            hit={hit}
                        />{" "}
                        <span className="search-chart-hit-large__variant">
                            {hit.variantName}
                        </span>
                    </div>
                    {entities.length > 0 && (
                        <ul className="search-chart-hit-large__entities">
                            {entities.map((entity, i) => (
                                <li
                                    key={entity}
                                    className="search-chart-hit-large__entity"
                                >
                                    {i === 0 && (
                                        <FontAwesomeIcon
                                            className="search-chart-hit-large__icon"
                                            icon={faMapMarkerAlt}
                                        />
                                    )}
                                    {entity}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="search-chart-hit-large__thumbnail">
                    <a
                        href={chartUrl}
                        className="search-chart-hit-large__thumbnail-link"
                        onClick={onClick}
                        data-algolia-index={getIndexName(
                            SearchIndexName.ExplorerViewsMdimViewsAndCharts
                        )}
                        data-algolia-object-id={hit.objectID}
                        data-algolia-position={hit.__position}
                    >
                        <div className="search-chart-hit-large__img-container">
                            {imgError && (
                                <div className="search-chart-hit-large__img-error">
                                    <FontAwesomeIcon icon={faHeartBroken} />
                                    <span>Chart preview not available</span>
                                </div>
                            )}
                            <img
                                key={previewUrl}
                                className={cx("search-chart-hit-large__img", {
                                    "search-chart-hit-large__img--loaded":
                                        imgLoaded,
                                    "search-chart-hit-large__img--error":
                                        imgError,
                                })}
                                loading="lazy"
                                width={DEFAULT_GRAPHER_WIDTH}
                                height={DEFAULT_GRAPHER_HEIGHT}
                                src={previewUrl}
                                onLoad={() => setImgLoaded(true)}
                                onError={() => setImgError(true)}
                            />
                        </div>
                    </a>
                </div>
            </div>
        </SearchAsDraft>
    )
}
