/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { SearchResultType, type SearchState } from "@ourworldindata/types"
import { SearchContext } from "./SearchContext.js"
import { useInfiniteSearchOffset } from "./searchHooks.js"

const STATE: SearchState = {
    query: "gdp",
    filters: [],
    requireAllCountries: false,
    resultType: SearchResultType.ALL,
}
const RECORDS = Array.from({ length: 20 }, (_, i) => ({ slug: `article-${i}` }))

function setup(): {
    requests: { offset: number; length: number }[]
    wrapper: ({ children }: { children: ReactNode }) => ReactNode
} {
    const requests: { offset: number; length: number }[] = []
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
        <QueryClientProvider client={queryClient}>
            <SearchContext.Provider value={{ state: STATE } as never}>
                {children}
            </SearchContext.Provider>
        </QueryClientProvider>
    )
    return { requests, wrapper }
}

describe(useInfiniteSearchOffset, () => {
    it("shows the first page at the size known once it has loaded, and continues after it", async () => {
        const { requests, wrapper } = setup()
        const queryFn = async (
            _state: SearchState,
            offset: number,
            length: number
        ) => {
            requests.push({ offset, length })
            return {
                hits: RECORDS.slice(offset, offset + length),
                nbHits: RECORDS.length,
            } as never
        }
        // Articles share their first-page slots with profiles, whose count
        // arrives later: the first page is requested at 4 and, once two
        // profiles are found, shows 2
        const { result, rerender } = renderHook(
            ({ firstPageSize }: { firstPageSize: number }) =>
                useInfiniteSearchOffset<{ slug: string }>({
                    queryKey: () => ["articles"],
                    queryFn,
                    firstPageSize,
                    firstPageFetchSize: 4,
                    laterPageSize: 6,
                }),
            { wrapper, initialProps: { firstPageSize: 4 } }
        )
        await waitFor(() => expect(result.current.hits).toHaveLength(4))
        rerender({ firstPageSize: 2 })

        expect(result.current.hits.map((hit) => hit.slug)).toEqual([
            "article-0",
            "article-1",
        ])
        expect(result.current.hasNextPage).toBe(true)

        await act(() => result.current.fetchNextPage())

        expect(requests).toEqual([
            { offset: 0, length: 4 },
            { offset: 2, length: 6 },
        ])
        await waitFor(() => expect(result.current.hits).toHaveLength(8))
        expect(result.current.hits.map((hit) => hit.slug)).toEqual(
            RECORDS.slice(0, 8).map((record) => record.slug)
        )
    })
})
