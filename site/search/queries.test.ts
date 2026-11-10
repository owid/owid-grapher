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
 * one, and only one whose hand-picked queries include the reader's whole
 * query: the request is an exact filter on the normalized query, with no text
 * search. Topic and country filters don't narrow it: a pin is a deliberate
 * pick for that exact search.
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
    it("filters featured-viz pages on the normalized query, ignoring topic and country filters", async () => {
        const { client, searchForHits } = makeClient()

        await queryFeaturedViz(
            client,
            makeState({
                query: "  Cause-of-Death?",
                filters: [
                    createTopicFilter("Health"),
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
            query: "",
            filters: 'type:featured-viz AND pinnedForSearches:"cause of death"',
            hitsPerPage: 1,
        })
        // Filters leave no trace in the request
        expect(JSON.stringify(request)).not.toContain("Health")
        expect(JSON.stringify(request)).not.toContain("France")
    })

    it("returns the hit Algolia found, or null when there is none", async () => {
        const hit = { objectID: "c0", slug: "migration", type: "featured-viz" }
        const { client, searchForHits } = makeClient()
        searchForHits.mockResolvedValueOnce({
            results: [{ hits: [hit], nbHits: 1 }],
        })
        const state = makeState({ query: "migration" })

        expect(await queryFeaturedViz(client, state)).toEqual(hit)
        expect(await queryFeaturedViz(client, state)).toBeNull()
    })

    it("asks nothing when the query is only punctuation", async () => {
        const { client, searchForHits } = makeClient()

        const hit = await queryFeaturedViz(client, makeState({ query: "?!" }))

        expect(hit).toBeNull()
        expect(searchForHits).not.toHaveBeenCalled()
    })
})
