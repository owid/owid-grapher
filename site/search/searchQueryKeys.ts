import { SearchState } from "./searchTypes.js"

/**
 * Query Key factory for search
 * Provides hierarchical query keys for better cache management and invalidation
 */
export const searchQueryKeys = {
    // Base key for all data catalog queries
    all: ["dataCatalog"] as const,

    // Search-related queries
    allSearches: () => [...searchQueryKeys.all, "allSearches"] as const,
    search: (state: SearchState) =>
        [...searchQueryKeys.allSearches(), state] as const,

    // Ribbons-related queries
    allRibbons: () => [...searchQueryKeys.all, "allRibbons"] as const,
    ribbons: (state: SearchState) =>
        [...searchQueryKeys.allRibbons(), state] as const,
} as const
