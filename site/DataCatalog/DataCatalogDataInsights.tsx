import { commafyNumber } from "@ourworldindata/utils"
import { PagesHit } from "../search/SearchPanel.js"
import { DataCatalogResearchSearchResult } from "./DataCatalogUtils.js"
import { CatalogComponentId } from "./DataCatalogState.js"

export const DataCatalogDataInsights = ({
    results,
    componentCount,
    setComponentCount,
}: {
    results?: DataCatalogResearchSearchResult
    componentCount?: Record<CatalogComponentId, number>
    setComponentCount?: (componentId: CatalogComponentId, count: number) => void
}) => {
    const hits = results?.hits
    if (!hits || !hits.length) return null

    const { nbHits } = results
    const insightsToShow =
        componentCount?.[CatalogComponentId.DATA_INSIGHTS] || 2
    const showMoreAvailable = insightsToShow < nbHits

    const handleShowMore = () => {
        if (setComponentCount) {
            setComponentCount(
                CatalogComponentId.DATA_INSIGHTS,
                insightsToShow + 4
            )
        }
    }

    return (
        <div
            className="search-results span-cols-12 col-start-2"
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
                                {showMoreAvailable && setComponentCount && (
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
