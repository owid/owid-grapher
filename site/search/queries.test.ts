import { describe, expect, it, vi } from "vitest"
import type { LiteClient } from "algoliasearch/lite"
import { SearchResultType, SearchState } from "@ourworldindata/types"
import { queryFeaturedViz } from "./queries.js"
import {
    createCountryFilter,
    createTopicFilter,
    PAGES_INDEX,
} from "./searchUtils.js"

/**
 * The featured viz at the top of the Data results comes from its own
 * pages-index request. It must only ever return featured-viz pages, at most
 * one, narrowed by the topic filter but never by country filters (featured-viz
 * pages aren't tagged with countries, and putting countries in the query
 * would hide a relevant page).
 */

function makeClient(): {
    client: LiteClient
    searchForHits: ReturnType<typeof vi.fn>
} {
    const searchForHits = vi.fn().mockResolvedValue({
        results: [{ hits: [], nbHits: 0 }],
    })
    return { client: { searchForHits } as unknown as LiteClient, searchForHits }
}

function makeState(overrides: Partial<SearchState>): SearchState {
    return {
        query: "",
        filters: [],
        requireAllCountries: false,
        resultType: SearchResultType.ALL,
        ...overrides,
    }
}

describe(queryFeaturedViz, () => {
    it("asks for the single best featured-viz page, narrowed by topic, ignoring countries", async () => {
        const { client, searchForHits } = makeClient()

        await queryFeaturedViz(
            client,
            makeState({
                query: "migration",
                filters: [
                    createTopicFilter("Migration"),
                    createCountryFilter("France"),
                ],
            })
        )

        expect(searchForHits).toHaveBeenCalledOnce()
        const [requests] = searchForHits.mock.calls[0]
        expect(requests).toHaveLength(1)
        const [request] = requests
        expect(request).toMatchObject({
            indexName: PAGES_INDEX,
            query: "migration",
            filters: "type:featured-viz",
            facetFilters: [["tags:Migration"]],
            hitsPerPage: 1,
        })
        // Country filters leave no trace in the request
        expect(JSON.stringify(request)).not.toContain("France")
    })
})
