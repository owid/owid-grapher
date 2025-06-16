import { useEffect, useMemo, useState } from "react"
import cx from "classnames"
import { Region } from "@ourworldindata/utils"
import {
    ChartRecordType,
    IChartHit,
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
import { AsDraft } from "../AsDraft/AsDraft.js"

export function ChartHitMedium({
    hit,
    searchQueryRegionsMatches,
    onClick,
}: {
    hit: IChartHit | IDataCatalogHit
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

    const chartTypes = [
        { type: "map", label: "World map" },
        { type: "line", label: "Line chart" },
        { type: "slope", label: "Slope chart" },
    ]

    return (
        <AsDraft name="Chart (Medium)" className="chart-hit-medium">
            <div className="chart-hit-medium__container">
                <div className="chart-hit-medium__content">
                    <div className="chart-hit-medium__title-container">
                        <Highlight
                            attribute="title"
                            highlightedTagName="strong"
                            className="chart-hit-medium__title"
                            hit={hit}
                        />{" "}
                        <span className="chart-hit-medium__variant">
                            {hit.variantName}
                        </span>
                    </div>
                    {entities.length > 0 && (
                        <ul className="chart-hit-medium__entities">
                            {entities.map((entity, i) => (
                                <li
                                    key={entity}
                                    className="chart-hit-medium__entity"
                                >
                                    {i === 0 && (
                                        <FontAwesomeIcon
                                            className="chart-hit-medium__icon"
                                            icon={faMapMarkerAlt}
                                        />
                                    )}
                                    {entity}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="chart-hit-medium__thumbnails">
                    {chartTypes.map((chartType, index) => {
                        const isMainChart = index === 0
                        const thumbnailUrl = isMainChart ? previewUrl : ""

                        return (
                            <a
                                key={chartType.type}
                                href={chartUrl}
                                className="chart-hit-medium__thumbnail-link"
                                onClick={onClick}
                                data-algolia-index={getIndexName(
                                    SearchIndexName.ExplorerViewsMdimViewsAndCharts
                                )}
                                data-algolia-object-id={hit.objectID}
                                data-algolia-position={hit.__position}
                            >
                                <div className="chart-hit-medium__img-container">
                                    {isMainChart && imgError && (
                                        <div className="chart-hit-medium__img-error">
                                            <FontAwesomeIcon
                                                icon={faHeartBroken}
                                            />
                                            <span>
                                                Chart preview not available
                                            </span>
                                        </div>
                                    )}
                                    {isMainChart ? (
                                        <img
                                            key={previewUrl}
                                            className={cx(
                                                "chart-hit-medium__img",
                                                {
                                                    "chart-hit-medium__img--loaded":
                                                        imgLoaded,
                                                    "chart-hit-medium__img--error":
                                                        imgError,
                                                }
                                            )}
                                            loading="lazy"
                                            width={DEFAULT_GRAPHER_WIDTH}
                                            height={DEFAULT_GRAPHER_HEIGHT}
                                            src={thumbnailUrl}
                                            onLoad={() => setImgLoaded(true)}
                                            onError={() => setImgError(true)}
                                        />
                                    ) : (
                                        <div className="chart-hit-medium__img-placeholder">
                                            <span className="chart-hit-medium__placeholder-text">
                                                {chartType.type.toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="chart-hit-medium__thumbnail-label">
                                    {chartType.label}
                                </div>
                            </a>
                        )
                    })}
                </div>
            </div>
        </AsDraft>
    )
}
