import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { commafyNumber } from "@ourworldindata/utils"
import * as React from "react"
import { SearchDataTopicsResponse } from "./searchTypes.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedCountries } from "./searchHooks.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { SearchChartHitComponent } from "./SearchChartHitComponent.js"

const analytics = new SiteAnalytics()

export const SearchDataTopic = ({
    result: { title, charts },
}: {
    result: SearchDataTopicsResponse
}) => {
    const {
        actions: { setTopic },
    } = useSearchContext()

    const selectedCountries = useSelectedCountries()

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
        <SearchAsDraft
            name="Data Topic"
            className="col-start-2 span-cols-12 col-sm-start-2 span-sm-cols-13>"
        >
            <div className="search-data-topic">
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
                        {charts.hits.map((hit, i) => (
                            <li
                                className="search-data-topic-hit"
                                key={hit.objectID}
                            >
                                <SearchChartHitComponent
                                    hit={hit}
                                    mode={i === 0 ? "medium" : "small"}
                                    onClick={() => {
                                        analytics.logDataCatalogResultClick(
                                            hit,
                                            i + 1,
                                            "ribbon",
                                            title
                                        )
                                    }}
                                    searchQueryRegionsMatches={
                                        selectedCountries
                                    }
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
                    {charts.nbHits === 1
                        ? `See 1 chart`
                        : `See ${commafyNumber(charts.nbHits)} charts`}
                    <FontAwesomeIcon icon={faArrowRight} />
                </button>
            </div>
        </SearchAsDraft>
    )
}
