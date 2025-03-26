import { commafyNumber } from "@ourworldindata/utils"
import * as React from "react"
import { PagesHit } from "../search/SearchPanel.js"
import { DataCatalogPageSearchResult } from "./DataCatalogUtils.js"

export const DataCatalogDataInsights = ({
    results,
}: {
    results?: DataCatalogPageSearchResult
}) => {
    const hits = results?.hits
    if (!hits || !hits.length) return null

    const { nbHits } = results

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
                        {nbHits > 2 && (
                            <div className="search-results__show-more-container">
                                <em>{`Showing 2 of ${commafyNumber(nbHits)} results`}</em>
                            </div>
                        )}
                    </div>
                </header>
                <div className="search-results__list-container">
                    <ul className="search-results__pages-list grid grid-cols-2 grid-sm-cols-1">
                        {hits.map((hit) => (
                            <li
                                className="search-results__page-hit"
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
