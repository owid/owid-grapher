import { commafyNumber } from "@ourworldindata/utils"
import { PagesHit } from "../search/SearchPanel.js"
import { DataCatalogPageSearchResult } from "./DataCatalogUtils.js"

export const DataCatalogDataInsights = ({
    results,
    insightsToShow,
    setInsightsToShow,
}: {
    results?: DataCatalogPageSearchResult
    insightsToShow: number
    setInsightsToShow?: (count: number) => void
}) => {
    const hits = results?.hits
    if (!hits || !hits.length) return null

    const { nbHits } = results
    const showMoreAvailable = insightsToShow < nbHits

    const handleShowMore = () => {
        if (setInsightsToShow) {
            setInsightsToShow(insightsToShow + 2)
        }
    }

    return (
        <div
            className="search-results span-cols-12 col-start-2"
            style={{ marginBottom: "2rem" }}
            data-active-filter="all"
        >
            <section className="search-results__pages">
                <header className="search-results__header-container">
                    <div className="search-results__header">
                        <h2 className="h2-bold search-results__section-title">
                            Data insights
                        </h2>
                        {nbHits > insightsToShow && (
                            <div className="search-results__show-more-container">
                                <em>{`Showing ${insightsToShow} of ${commafyNumber(nbHits)} results`}</em>
                                {showMoreAvailable && setInsightsToShow && (
                                    <button
                                        className="search-results__show-more-btn"
                                        onClick={handleShowMore}
                                    >
                                        Show more
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </header>
                <div className="search-results__list-container">
                    <ul className="search-results__pages-list grid grid-cols-2 grid-sm-cols-1">
                        {hits.map((hit) => (
                            <li
                                className="search-results__page-hit"
                                style={{ display: "block" }} // override Search.scss
                                key={hit.objectID}
                            >
                                <PagesHit hit={hit} />
                            </li>
                        ))}
                    </ul>
                </div>
            </section>
        </div>
    )
}
