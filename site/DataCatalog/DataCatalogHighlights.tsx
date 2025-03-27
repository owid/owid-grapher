import {
    DataCatalogRibbonResult,
    DataCatalogSearchResult,
} from "./DataCatalogUtils.js"
import { ChartHit } from "../search/ChartHit.js"
import { Region } from "@ourworldindata/utils"
import { CatalogComponentId } from "./DataCatalogState.js"

export const DataCatalogHighlights = ({
    results,
    selectedCountries,
    componentCount,
}: {
    results: DataCatalogRibbonResult[] | DataCatalogSearchResult | undefined
    selectedCountries: Region[]
    componentCount: Record<CatalogComponentId, number>
}) => {
    if (!results) return null

    // Extract the first two results
    const highlights = Array.isArray(results)
        ? results
              .flatMap((ribbon) => ribbon.hits)
              .slice(0, componentCount[CatalogComponentId.HIGHLIGHTS])
        : results.hits.slice(0, componentCount[CatalogComponentId.HIGHLIGHTS])

    if (highlights.length === 0) return null

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
                            Highlights
                        </h2>
                    </div>
                </header>
                <ul className="data-catalog-highlights-container grid grid-cols-2 gap-4">
                    {highlights.map((hit) => (
                        <li
                            className="data-catalog-highlight-hit"
                            key={hit.objectID}
                            style={{ listStyleType: "none" }}
                        >
                            <ChartHit
                                hit={hit}
                                searchQueryRegionsMatches={selectedCountries}
                            />
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    )
}
