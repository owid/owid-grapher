import { useQuery } from "@tanstack/react-query"
import { SearchClient } from "algoliasearch"
import { TagGraphRoot } from "@ourworldindata/types"
import {
    DataCatalogRibbonResult,
    DataCatalogSearchResult,
    SearchState,
} from "./searchTypes.js"
import {
    queryDataCatalogRibbons,
    queryDataCatalogSearch,
} from "./searchUtils.js"
import { searchQueryKeys } from "./searchQueryKeys.js"

/**
 * Custom hook to get facets data for SearchTopicsRefinementList
 * Automatically switches between ribbon and search queries based on shouldShowRibbons
 */
export const useSearchFacets = (
    searchClient: SearchClient,
    searchState: SearchState,
    tagGraph: TagGraphRoot,
    shouldShowRibbons: boolean
): Record<string, number> | undefined => {
    const ribbonsQuery = useQuery<DataCatalogRibbonResult[], Error>({
        queryKey: searchQueryKeys.ribbons(searchState),
        queryFn: () =>
            queryDataCatalogRibbons(searchClient, searchState, tagGraph),
        enabled: shouldShowRibbons,
    })

    const searchQuery = useQuery<DataCatalogSearchResult, Error>({
        queryKey: searchQueryKeys.search(searchState),
        queryFn: () => queryDataCatalogSearch(searchClient, searchState),
        enabled: !shouldShowRibbons,
    })

    if (shouldShowRibbons) {
        // For ribbons, create facets from ribbon results
        return ribbonsQuery.data
            ? Object.fromEntries(
                  ribbonsQuery.data
                      .sort((a, b) => b.nbHits - a.nbHits)
                      .map((r) => [r.title, r.nbHits])
              )
            : undefined
    } else {
        // For search, use facets from search results
        return searchQuery.data?.facets?.tags
    }
}
