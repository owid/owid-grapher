import { expect, it, describe } from "vitest"
import type { EndRequest } from "@algolia/client-common"
import { SearchIndexName } from "@ourworldindata/types"
import { getIndexName } from "./searchClient.js"
import { shouldUseCachedQueriesEndpoint } from "./searchClients.js"

const makeRequest = (requests: unknown[]): EndRequest =>
    ({
        method: "POST",
        url: "https://test-app-id-dsn.algolia.net/1/indexes/*/queries",
        headers: {},
        data: JSON.stringify({ requests }),
    }) as EndRequest

describe(shouldUseCachedQueriesEndpoint, () => {
    it("routes all-empty-query payloads to the caching endpoint", () => {
        const request = makeRequest([
            {
                indexName: getIndexName(
                    SearchIndexName.ExplorerViewsMdimViewsAndCharts
                ),
                query: "",
            },
            { indexName: getIndexName(SearchIndexName.Pages), query: "" },
        ])
        expect(shouldUseCachedQueriesEndpoint(request)).toBe(true)
    })

    it("does not route payloads with a non-empty query", () => {
        const request = makeRequest([
            { indexName: getIndexName(SearchIndexName.Pages), query: "co2" },
        ])
        expect(shouldUseCachedQueriesEndpoint(request)).toBe(false)
    })

    it("does not route payloads querying the chronological pages index", () => {
        const request = makeRequest([
            {
                indexName: getIndexName(SearchIndexName.PagesChronological),
                query: "",
            },
        ])
        expect(shouldUseCachedQueriesEndpoint(request)).toBe(false)
    })

    it("does not route mixed payloads if any request is chronological", () => {
        const request = makeRequest([
            { indexName: getIndexName(SearchIndexName.Pages), query: "" },
            {
                indexName: getIndexName(SearchIndexName.PagesChronological),
                query: "",
            },
        ])
        expect(shouldUseCachedQueriesEndpoint(request)).toBe(false)
    })
})
