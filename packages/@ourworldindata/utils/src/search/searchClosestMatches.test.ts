import { expect, it, describe, vi } from "vitest"
import { searchSingleForHitsWithClosestMatches } from "./searchClosestMatches.js"

// Used by both site/search/queries.ts and functions/api/search/searchApi.ts —
// covering it here guarantees the "closest matches" fallback behaves
// identically for both consumers, not just for the site.

type MockHit = { objectID: string; _rankingInfo?: { words?: number } }

type MockClient = { searchForHits: ReturnType<typeof vi.fn> }

function makeClient(responses: unknown[]): MockClient {
    const searchForHits = vi.fn()
    for (const response of responses) {
        searchForHits.mockResolvedValueOnce({ results: [response] })
    }
    return { searchForHits }
}

describe(searchSingleForHitsWithClosestMatches, () => {
    it("returns the primary response unchanged when it already has hits", async () => {
        const primaryResponse = { hits: [{ objectID: "1" }], nbHits: 1 }
        const client = makeClient([primaryResponse])

        const result = await searchSingleForHitsWithClosestMatches<MockHit>(
            client as never,
            [{ query: "malaria" }]
        )

        expect(result).toBe(primaryResponse)
        expect(client.searchForHits).toHaveBeenCalledOnce()
    })

    it("does not retry when the query is empty (browsing, not searching)", async () => {
        const primaryResponse = { hits: [], nbHits: 0 }
        const client = makeClient([primaryResponse])

        const result = await searchSingleForHitsWithClosestMatches<MockHit>(
            client as never,
            [{ query: "" }]
        )

        expect(result).toBe(primaryResponse)
        expect(client.searchForHits).toHaveBeenCalledOnce()
    })

    it("does not retry on pages after the first (page or offset set)", async () => {
        const primaryResponse = { hits: [], nbHits: 0 }
        const clientPage = makeClient([primaryResponse])
        const clientOffset = makeClient([primaryResponse])

        await searchSingleForHitsWithClosestMatches<MockHit>(
            clientPage as never,
            [{ query: "malaria", page: 1 }]
        )
        await searchSingleForHitsWithClosestMatches<MockHit>(
            clientOffset as never,
            [{ query: "malaria", offset: 10 }]
        )

        expect(clientPage.searchForHits).toHaveBeenCalledOnce()
        expect(clientOffset.searchForHits).toHaveBeenCalledOnce()
    })

    it("stays honestly empty when the best relaxed match shares zero words", async () => {
        const primaryResponse = { hits: [], nbHits: 0 }
        const relaxedResponse = { hits: [], nbHits: 0 }
        const client = makeClient([primaryResponse, relaxedResponse])

        const result = await searchSingleForHitsWithClosestMatches<MockHit>(
            client as never,
            [{ query: "asdkjfhaskjdfh" }]
        )

        expect(result).toBe(primaryResponse)
        expect(result.closestMatches).toBeUndefined()
    })

    it('stays honestly empty for a common single-word overlap ("world cup")', async () => {
        const primaryResponse = { hits: [], nbHits: 0 }
        const relaxedResponse = {
            hits: [{ objectID: "1", _rankingInfo: { words: 1 } }],
            // "world" alone matches hundreds of unrelated documents.
            nbHits: 5000,
        }
        const client = makeClient([primaryResponse, relaxedResponse])

        const result = await searchSingleForHitsWithClosestMatches<MockHit>(
            client as never,
            [{ query: "world cup" }]
        )

        expect(result).toBe(primaryResponse)
    })

    it('rescues a distinctive single-word overlap ("malaria worldwide")', async () => {
        const primaryResponse = { hits: [], nbHits: 0 }
        const relaxedResponse = {
            hits: [
                { objectID: "malaria-1", _rankingInfo: { words: 1 } },
                { objectID: "malaria-2", _rankingInfo: { words: 1 } },
                // A hit that only matched via a different, unrelated word
                // should be excluded from the rescued tier.
                { objectID: "unrelated", _rankingInfo: { words: 1 } },
            ],
            // "malaria" is distinctive: well under the 100-hit threshold.
            nbHits: 43,
        }
        const client = makeClient([primaryResponse, relaxedResponse])

        const result = await searchSingleForHitsWithClosestMatches<MockHit>(
            client as never,
            [{ query: "malaria worldwide" }]
        )

        expect(result.closestMatches).toBe(true)
        expect(result.hits).toHaveLength(3)
        expect(result.nbHits).toBe(43)
        expect(result.page).toBe(0)
        expect(result.nbPages).toBe(1)
    })

    it("keeps only the best-matched-words tier for multi-word rescues", async () => {
        const primaryResponse = { hits: [], nbHits: 0 }
        const relaxedResponse = {
            hits: [
                { objectID: "two-word-match", _rankingInfo: { words: 2 } },
                { objectID: "one-word-match", _rankingInfo: { words: 1 } },
            ],
            nbHits: 2,
        }
        const client = makeClient([primaryResponse, relaxedResponse])

        const result = await searchSingleForHitsWithClosestMatches<MockHit>(
            client as never,
            [{ query: "malaria deaths" }]
        )

        expect(result.closestMatches).toBe(true)
        expect(result.hits).toEqual([
            { objectID: "two-word-match", _rankingInfo: { words: 2 } },
        ])
        // Multi-word tiers use the fetched tier length, not the raw nbHits,
        // since the full tier may extend past the fetched page.
        expect(result.nbHits).toBe(1)
    })

    it("requests removeWordsIfNoResults and getRankingInfo only on the retry", async () => {
        const primaryResponse = { hits: [], nbHits: 0 }
        const relaxedResponse = { hits: [], nbHits: 0 }
        const client = makeClient([primaryResponse, relaxedResponse])

        await searchSingleForHitsWithClosestMatches<MockHit>(client as never, [
            { query: "malaria worldwide", hitsPerPage: 9 },
        ])

        const [firstCall, secondCall] = client.searchForHits.mock.calls
        expect(firstCall[0][0]).not.toHaveProperty("removeWordsIfNoResults")
        expect(secondCall[0][0]).toMatchObject({
            query: "malaria worldwide",
            hitsPerPage: 9,
            removeWordsIfNoResults: "allOptional",
            getRankingInfo: true,
        })
    })
})
