/**
 * @vitest-environment happy-dom
 */

import { expect, it } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from "@tanstack/react-query"
import { useHasSearchError } from "./searchHooks.js"
import { CHARTS_INDEX } from "./searchUtils.js"

const failingQueryFn = () => Promise.reject(new Error("Algolia unreachable"))
const succeedingQueryFn = () => Promise.resolve({ hits: [] })

// Renders `useHasSearchError` alongside a single query, so we can watch how the
// hook reacts to that query failing or succeeding.
function renderWithQuery(initialQueryKey: readonly unknown[]) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return renderHook(
        ({ queryKey }: { queryKey: readonly unknown[] }) => {
            const query = useQuery({
                queryKey,
                queryFn:
                    queryKey === initialQueryKey
                        ? failingQueryFn
                        : succeedingQueryFn,
            })
            return { hasSearchError: useHasSearchError(), status: query.status }
        },
        {
            initialProps: { queryKey: initialQueryKey },
            wrapper: ({ children }: { children: ReactNode }) => (
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            ),
        }
    )
}

it("reports an error when a search query fails", async () => {
    const { result } = renderWithQuery([CHARTS_INDEX, "charts", {}])

    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(result.current.hasSearchError).toBe(true)
})

it("ignores failures of queries that aren't searches", async () => {
    const { result } = renderWithQuery(["chart-hit-data", "life-expectancy"])

    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(result.current.hasSearchError).toBe(false)
})

it("ignores a search error cached from a previous query", async () => {
    const { result, rerender } = renderWithQuery([CHARTS_INDEX, "charts", {}])

    await waitFor(() => expect(result.current.hasSearchError).toBe(true))

    rerender({ queryKey: [CHARTS_INDEX, "charts", { query: "gdp" }] })

    await waitFor(() => expect(result.current.status).toBe("success"))
    expect(result.current.hasSearchError).toBe(false)
})
