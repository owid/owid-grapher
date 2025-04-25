import React from "react"
import { commafyNumber } from "@ourworldindata/utils"
import { PagesHit } from "../search/SearchPanel.js"
import { DataCatalogResearchSearchResult } from "./DataCatalogUtils.js"
import { CatalogComponentId } from "./DataCatalogState.js"

interface DataCatalogResearchProps {
    results?: DataCatalogResearchSearchResult
    componentCount: Record<CatalogComponentId, number>
    setComponentCount?: (componentId: CatalogComponentId, count: number) => void
}

export const DataCatalogResearch: React.FC<DataCatalogResearchProps> = ({
    results,
    componentCount,
    setComponentCount,
}) => {
    const hits = results?.hits
    if (!hits || !hits.length) return null

    const { nbHits } = results
    const researchToShow = componentCount[CatalogComponentId.RESEARCH] || 4
    const showMoreAvailable = researchToShow < nbHits

    const handleShowMore = () => {
        if (setComponentCount) {
            setComponentCount(CatalogComponentId.RESEARCH, researchToShow + 4)
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
                            Research & Writing
                        </h2>
                        {nbHits > researchToShow && (
                            <div className="search-results__show-more-container">
                                <em>{`Showing ${researchToShow} of ${commafyNumber(nbHits)} results`}</em>
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
