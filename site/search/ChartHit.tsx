import React, { useEffect, useMemo, useState } from "react"
import cx from "classnames"
import { Region } from "@ourworldindata/utils"
import { IChartHit, SearchIndexName } from "./searchTypes.js"
import { getEntityQueryStr, pickEntitiesForChartHit } from "./SearchUtils.js"
import { HitAttributeHighlightResult } from "instantsearch.js"
import {
    BAKED_GRAPHER_EXPORTS_BASE_URL,
    BAKED_GRAPHER_URL,
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

export function ChartHit({
    hit,
    searchQueryRegionsMatches,
}: {
    hit: IChartHit
    searchQueryRegionsMatches?: Region[] | undefined
}) {
    const [imgLoaded, setImgLoaded] = useState(false)
    const [imgError, setImgError] = useState(false)

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
    const queryStr = useMemo(() => getEntityQueryStr(entities), [entities])
    const previewUrl = queryStr
        ? `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${hit.slug}.svg${queryStr}`
        : `${BAKED_GRAPHER_EXPORTS_BASE_URL}/${hit.slug}.svg`

    useEffect(() => {
        setImgLoaded(false)
        setImgError(false)
    }, [previewUrl])

    return (
        <a
            href={`${BAKED_GRAPHER_URL}/${hit.slug}${queryStr}`}
            className="chart-hit"
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
