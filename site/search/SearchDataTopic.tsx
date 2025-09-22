import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { commafyNumber } from "@ourworldindata/utils"
import * as React from "react"
import { SearchDataTopicsResponse } from "./searchTypes.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedRegionNames } from "./searchHooks.js"
import { SearchChartHitComponent } from "./SearchChartHitComponent.js"

export const SearchDataTopic = ({
    result: { title, charts },
}: {
    result: SearchDataTopicsResponse
}) => {
    const {
        actions: { setTopic },
        analytics,
    } = useSearchContext()

    const selectedRegionNames = useSelectedRegionNames(true)

    if (charts.nbHits === 0) return null
    const titleLabel = title.replaceAll(" and ", " & ")

    const handleAddTopicClick = (e: React.MouseEvent) => {
        e.preventDefault()
        setTopic(title)
        window.scrollTo({
            top: 0,
        })
    }

    return (
        <div className="search-data-topic col-start-2 span-cols-12 col-sm-start-2 span-sm-cols-13">
            <button
                className="search-data-topic__header-button"
                aria-label={`Add topic ${title} to filters`}
                onClick={handleAddTopicClick}
            >
                <div className="search-data-topic__header">
                    <h2>{titleLabel}</h2>
                    <span className="search-data-topic__hit-count">
                        {commafyNumber(charts.nbHits)}{" "}
                        {charts.nbHits === 1 ? "chart" : "charts"}
                        <FontAwesomeIcon icon={faArrowRight} />
                    </span>
                </div>
            </button>
            <div className="search-data-topic-hits">
                <ul className="search-data-topic-list">
                    {charts.hits.map((hit, hitIndex) => (
                        <li
                            className="search-data-topic-hit"
                            key={hit.objectID}
                        >
                            <SearchChartHitComponent
                                hit={hit}
                                variant={hitIndex === 0 ? "medium" : "small"}
                                onClick={() => {
                                    analytics.logDataCatalogResultClick(
                                        hit,
                                        hitIndex + 1,
                                        "ribbon",
                                        title
                                    )
                                }}
                                selectedRegionNames={selectedRegionNames}
                            />
                        </li>
                    ))}
                </ul>
            </div>
            <button
                className="search-data-topic__see-all-button"
                aria-label={`Add ${title} to filters`}
                onClick={handleAddTopicClick}
            >
                <span>See all charts on {titleLabel}</span>
                <FontAwesomeIcon icon={faArrowRight} />
            </button>
        </div>
    )
}
