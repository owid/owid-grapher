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
 * pages-index request, an exact filter with no text search. The reader's
 * whole query must be one of a page's pinned searches; a selected topic
 * narrows to pages tagged with it, and is enough on its own when no words
 * are typed. Country filters don't narrow it. Of several matching pages,
 * only Algolia's top-ranked one (the most viewed) is asked for.
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
    it("filters on the normalized query and the selected topic, ignoring countries", async () => {
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
            facetFilters: [["tags:Health"]],
            hitsPerPage: 1,
        })
        expect(JSON.stringify(request)).not.toContain("France")
    })

    it("filters on the selected topic alone when no words are typed", async () => {
        const { client, searchForHits } = makeClient()

        await queryFeaturedViz(
            client,
            makeState({
                filters: [createTopicFilter("Child & Infant Mortality")],
            })
        )

        const [[request]] = searchForHits.mock.calls[0]
        expect(request.filters).toBe("type:featured-viz")
        expect(request.facetFilters).toEqual([
            ["tags:Child & Infant Mortality"],
        ])
    })

    it("asks nothing when the query is only punctuation", async () => {
        const { client, searchForHits } = makeClient()

        const hit = await queryFeaturedViz(client, makeState({ query: "?!" }))

        expect(hit).toBeNull()
        expect(searchForHits).not.toHaveBeenCalled()
    })
})
