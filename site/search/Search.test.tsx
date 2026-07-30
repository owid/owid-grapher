/**
 * @vitest-environment happy-dom
 */

import { expect, it, describe } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom-v5-compat"
import type { LiteClient } from "algoliasearch/lite"
import { TagGraphRootName, type TagGraphRoot } from "@ourworldindata/types"
import { Search } from "./Search.js"

const topicTagGraph: TagGraphRoot = {
    children: [],
    id: 0,
    isTopic: false,
    isSearchable: false,
    name: TagGraphRootName,
    path: [0],
    slug: null,
    weight: 0,
}

// Every search query ultimately goes through `searchForHits` (see
// searchClosestMatches.ts in @ourworldindata/utils), so stubbing it is enough
// to simulate Algolia being up-but-empty or failing outright.
function makeSearchClient(
    searchForHits: (requests: unknown[]) => Promise<unknown>
): LiteClient {
    return { searchForHits } as unknown as LiteClient
}

const emptyResultsClient = makeSearchClient((requests) =>
    Promise.resolve({
        results: requests.map(() => ({
            hits: [],
            nbHits: 0,
            nbPages: 0,
            page: 0,
        })),
    })
)

const failingClient = makeSearchClient(() =>
    Promise.reject(new Error("This operation cannot be processed"))
)

function renderSearch(liteSearchClient: LiteClient) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    render(
        <MemoryRouter initialEntries={["/search?q=gdp"]}>
            <QueryClientProvider client={queryClient}>
                <Search
                    topicTagGraph={topicTagGraph}
                    liteSearchClient={liteSearchClient}
                />
            </QueryClientProvider>
        </MemoryRouter>
    )
}

describe("Search empty states", () => {
    it("shows the no-results notice when the search succeeds without hits", async () => {
        renderSearch(emptyResultsClient)

        expect(
            await screen.findByText(/no results for this query/i)
        ).toBeTruthy()
        expect(screen.queryByText(/temporarily unavailable/i)).toBeNull()
    })

    it("shows an error notice, not the no-results notice, when the search fails", async () => {
        renderSearch(failingClient)

        expect(
            await screen.findByText(/search is temporarily unavailable/i)
        ).toBeTruthy()
        expect(screen.queryByText(/no results for this query/i)).toBeNull()
    })
})
