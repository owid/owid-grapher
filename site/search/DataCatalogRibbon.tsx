import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { commafyNumber } from "@ourworldindata/utils"
import * as React from "react"
import { ChartHit } from "./ChartHit.js"
import { DataCatalogRibbonResult } from "./searchTypes.js"
import { SiteAnalytics } from "../SiteAnalytics.js"
import { useSearchContext } from "./SearchContext.js"
import { useSelectedCountries } from "./searchHooks.js"

const analytics = new SiteAnalytics()

export const DataCatalogRibbon = ({
    result,
}: {
    result: DataCatalogRibbonResult
}) => {
    const {
        actions: { addTopic },
    } = useSearchContext()
    const selectedCountries = useSelectedCountries()
    if (result.nbHits === 0) return null
    const titleLabel = result.title.replaceAll(" and ", " & ")
    const handleAddTopicClick = (e: React.MouseEvent) => {
        e.preventDefault()
        addTopic(result.title)
        window.scrollTo({
            top: 0,
        })
    }

    return (
        <div className="data-catalog-ribbon col-start-2 span-cols-12 col-sm-start-2 span-sm-cols-13">
            <button
                className="data-catalog-ribbon__header-button"
                aria-label={`Add topic ${result.title} to filters`}
                onClick={handleAddTopicClick}
            >
                <div className="data-catalog-ribbon__header">
                    <h2 className="body-1-regular">{titleLabel}</h2>
                    <span className="data-catalog-ribbon__hit-count body-2-semibold">
                        {commafyNumber(result.nbHits)}{" "}
                        {result.nbHits === 1 ? "chart" : "charts"}
                        <FontAwesomeIcon icon={faArrowRight} />
                    </span>
                </div>
            </button>
            <div className="data-catalog-ribbon-hits">
                <ul className="data-catalog-ribbon-list grid grid-cols-4">
                    {result.hits.map((hit, i) => (
                        <li
                            className="data-catalog-ribbon-hit"
                            key={hit.objectID}
                        >
                            <ChartHit
                                hit={hit}
                                onClick={() => {
                                    analytics.logDataCatalogResultClick(
                                        hit,
                                        i + 1,
                                        "ribbon",
                                        result.title
                                    )
                                }}
                                searchQueryRegionsMatches={selectedCountries}
                            />
                        </li>
                    ))}
                </ul>
            </div>
            <button
                className="data-catalog-ribbon__see-all-button"
                aria-label={`Add ${result.title} to filters`}
                onClick={handleAddTopicClick}
            >
                {result.nbHits === 1
                    ? `See 1 chart`
                    : `See ${commafyNumber(result.nbHits)} charts`}
                <FontAwesomeIcon icon={faArrowRight} />
            </button>
        </div>
    )
}
