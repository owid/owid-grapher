import { FilterType, SearchState } from "./searchTypes.js"
import {
    getCountryData,
    getFilterNamesOfType,
    getSelectedTopic,
} from "./searchUtils.js"
import { useSearchContext } from "./SearchContext.js"
import { Region } from "@ourworldindata/utils"
import { useInfiniteQuery } from "@tanstack/react-query"
import { SearchClient } from "algoliasearch"
import { SearchResponse } from "instantsearch.js"

export const useSelectedCountries = (): Region[] => {
    const selectedCountryNames = useSelectedCountryNames()
    return getCountryData(selectedCountryNames)
}

export const useSelectedTopic = (): string | undefined => {
    const { state } = useSearchContext()
    return getSelectedTopic(state.filters)
}

export const useSelectedCountryNames = (): Set<string> => {
    const { state } = useSearchContext()
    return getFilterNamesOfType(state.filters, FilterType.COUNTRY)
}
export function useInfiniteSearch<T extends SearchResponse<U>, U>({
    queryKey,
    queryFn,
}: {
    queryKey: (state: SearchState) => readonly (string | SearchState)[]
    queryFn: (searchClient: SearchClient, state: SearchState) => Promise<T>
}) {
    const { state, searchClient } = useSearchContext()

    const query = useInfiniteQuery<T, Error>({
        // Create a state with a static page param so that a single cache entry
        // is shared across all pages
        queryKey: queryKey({ ...state, page: 0 }),
        queryFn: ({ pageParam = 0 }) =>
            queryFn(searchClient, { ...state, page: pageParam }),
        getNextPageParam: (lastPage) => {
            const { page, nbPages } = lastPage
            return page < nbPages - 1 ? page + 1 : undefined
        },
    })

    const hits: U[] = query.data?.pages.flatMap((page) => page.hits) || []
    const totalResults = query.data?.pages[0]?.nbHits || 0

    return {
        ...query,
        hits,
        totalResults,
    }
}
