/**
 * @vitest-environment happy-dom
 */

import { expect, it, describe } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom-v5-compat"
import type { LiteClient } from "algoliasearch/lite"
import { TagGraphRootName, type TagGraphRoot } from "@ourworldindata/types"
import { Search } from "./Search.js"
import { CHARTS_INDEX } from "./searchUtils.js"

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

const emptyResults = (requests: unknown[]) =>
    Promise.resolve({
        results: requests.map(() => ({
            hits: [],
            nbHits: 0,
            nbPages: 0,
            page: 0,
        })),
    })

const emptyResultsClient = makeSearchClient(emptyResults)

const failingClient = makeSearchClient(() =>
    Promise.reject(new Error("This operation cannot be processed"))
)

// Fails only the charts index, so the Data template errors while the Writing
// template searches successfully.
const chartsOnlyFailingClient = makeSearchClient((requests) => {
    const failsChartsIndex = requests.some(
        (request) =>
            (request as { indexName?: string }).indexName === CHARTS_INDEX
    )
    if (failsChartsIndex)
        return Promise.reject(new Error("This operation cannot be processed"))
    return emptyResults(requests)
})

function renderSearch(
    liteSearchClient: LiteClient,
    searchParams: string = "?q=gdp"
) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    render(
        <MemoryRouter initialEntries={[`/search${searchParams}`]}>
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
        expect(screen.queryByText(/isn’t working right now/i)).toBeNull()
    })

    it("shows an error notice, not the no-results notice, when the search fails", async () => {
        renderSearch(failingClient)

        expect(
            await screen.findByText(/search isn’t working right now/i)
        ).toBeTruthy()
        expect(screen.queryByText(/no results for this query/i)).toBeNull()
    })

    it("drops the error notice once the failed query is no longer rendered", async () => {
        // The charts query keeps its cache entry (and its error) after the
        // toggle switches to Writing, because `resultType` is not part of the
        // query key — only the observer check keeps the notice from sticking.
        renderSearch(chartsOnlyFailingClient, "?q=gdp&resultType=data")

        expect(
            await screen.findByText(/search isn’t working right now/i)
        ).toBeTruthy()

        fireEvent.click(screen.getByLabelText("Writing"))

        expect(
            await screen.findByText(/no results for this query/i)
        ).toBeTruthy()
        expect(screen.queryByText(/isn’t working right now/i)).toBeNull()
    })
})
