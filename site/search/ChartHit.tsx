import React, { useEffect, useMemo, useState } from "react"
import cx from "classnames"
import { Region } from "@ourworldindata/utils"
import { ChartRecordType, IChartHit, SearchIndexName } from "./searchTypes.js"
import { getEntityQueryStr, pickEntitiesForChartHit } from "./SearchUtils.js"
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
import { IDataCatalogHit } from "../DataCatalog/DataCatalogUtils.js"
import { EXPLORERS_ROUTE_FOLDER } from "@ourworldindata/explorer"

export function ChartHit({
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

    const entities = useMemo(
        () =>
            pickEntitiesForChartHit(
                hit._highlightResult?.availableEntities as
                    | HitAttributeHighlightResult[]
                    | undefined,
                hit.availableEntities,
                searchQueryRegionsMatches
            ),
        [
            hit._highlightResult?.availableEntities,
            hit.availableEntities,
            searchQueryRegionsMatches,
        ]
    )
    const entityQueryStr = useMemo(
        () => getEntityQueryStr(entities),
        [entities]
    )

    const fullQueryParams = isExplorerView
        ? hit.queryParams! + entityQueryStr.replace("?", "&")
        : entityQueryStr

    function createExplorerViewThumbnailUrl(
        slug: string,
        fullQueryParams: string
    ): string {
        return `${EXPLORER_DYNAMIC_THUMBNAIL_URL}/${slug}.svg${fullQueryParams}`
    }
    function createGrapherThumbnailUrl(
        slug: string,
        fullQueryParams?: string
    ): string {
        return fullQueryParams
            ? `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${slug}.svg${fullQueryParams}`
            : `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${slug}.svg`
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
        <a
            href={chartUrl}
            className="chart-hit"
            onClick={onClick}
            data-algolia-index={getIndexName(SearchIndexName.Charts)}
            data-algolia-object-id={hit.objectID}
            data-algolia-position={hit.__position}
        >
            <div className="chart-hit-img-container">
                {imgError && (
                    <div className="chart-hit-img-error">
                        <FontAwesomeIcon icon={faHeartBroken} />
                        <span>Chart preview not available</span>
                    </div>
                )}
                <img
                    key={previewUrl}
                    className={cx({ loaded: imgLoaded, error: imgError })}
                    loading="lazy"
                    width={DEFAULT_GRAPHER_WIDTH}
                    height={DEFAULT_GRAPHER_HEIGHT}
                    src={previewUrl}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                />
            </div>
            <div className="chart-hit-title-container">
                <Highlight
                    attribute="title"
                    highlightedTagName="strong"
                    className="chart-hit-highlight"
                    hit={hit}
                />{" "}
                <span className="chart-hit-variant">{hit.variantName}</span>
            </div>
            {entities.length > 0 && (
                <ul className="chart-hit-entities">
                    {entities.map((entity, i) => (
                        <li key={entity}>
                            {i === 0 && (
                                <FontAwesomeIcon
                                    className="chart-hit-icon"
                                    icon={faMapMarkerAlt}
                                />
                            )}
                            {entity}
                        </li>
                    ))}
                </ul>
            )}
        </a>
    )
}
