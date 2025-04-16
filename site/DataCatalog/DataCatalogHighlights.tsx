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

    const highlights = Array.isArray(results)
        ? results
              .flatMap((ribbon) => ribbon.hits)
              .slice(0, componentCount[CatalogComponentId.HIGHLIGHTS])
        : results.hits.slice(0, componentCount[CatalogComponentId.HIGHLIGHTS])

    if (highlights.length === 0) return null

    // This design assumes that there is a single highlight to show
    return (
        <div
            className="search-results span-cols-12 col-start-2"
            style={{ marginTop: 32 }}
            data-active-filter="all"
        >
            <section className="search-results__pages">
                <ul className="data-catalog-highlights-container grid grid-cols-12">
                    {highlights.map((hit) => (
                        <li
                            className="data-catalog-highlight-hit span-cols-6 col-start-4"
                            key={hit.objectID}
                            style={{ listStyleType: "none", display: "block" }}
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
