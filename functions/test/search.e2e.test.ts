import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { unstable_startWorker } from "wrangler"

let worker: Awaited<ReturnType<typeof unstable_startWorker>>

async function workerFetch(pathname: string) {
    return worker.fetch(`http://example.com${pathname}`)
}

// Runs the real /api/search handler inside an actual Workers (workerd)
// runtime, unlike searchApi.integration.test.ts which exercises the same code
// under Node.
//
// These need a local Typesense with a populated index (`make
// reindex.typesense`) — the Algolia version they replaced could point at a
// public read-only production key, and Typesense has no equivalent. So they are
// opt-in and skipped in CI:
//
//     TYPESENSE_INTEGRATION_TESTS=1 yarn test run functions/test/search.e2e.test.ts
const enabled = Boolean(process.env.TYPESENSE_INTEGRATION_TESTS)

describe.skipIf(!enabled)(
    "search endpoint inside a real Workers runtime",
    () => {
        beforeAll(async () => {
            worker = await unstable_startWorker({
                config: "./functions/test/wrangler.search.e2e.jsonc",
                dev: { logLevel: "none" },
            })
        })

        afterAll(async () => {
            await worker.dispose()
        })

        it("searches charts", async () => {
            const response = await workerFetch(
                "/api/search?type=charts&q=population&hitsPerPage=3"
            )
            expect(response.status).toBe(200)

            const body = (await response.json()) as {
                query: string
                results: unknown[]
                nbHits: number
            }
            expect(body.query).toBe("population")
            expect(body.results.length).toBeGreaterThan(0)
            expect(body.nbHits).toBeGreaterThan(0)
        })

        it("searches pages", async () => {
            const response = await workerFetch(
                "/api/search?type=pages&q=climate%20change&hitsPerPage=3"
            )
            expect(response.status).toBe(200)

            const body = (await response.json()) as {
                query: string
                results: unknown[]
                nbHits: number
            }
            expect(body.query).toBe("climate change")
            expect(body.results.length).toBeGreaterThan(0)
            expect(body.nbHits).toBeGreaterThan(0)
        })

        it("returns a validation error for an unknown topic", async () => {
            const response = await workerFetch(
                "/api/search?type=charts&topics=NotARealTopic123"
            )
            expect(response.status).toBe(400)
        })

        // "deforestation brazil amazon rate" has no exact match but shares three
        // distinctive words with real charts — a query the closest-matches
        // fallback should rescue instead of returning nbHits: 0. (Algolia
        // rescues it too, returning `drivers-forest-loss-brazil-amazon`.)
        //
        // NB: "malaria worldwide" (the example this test used to rely on) is a
        // zero-result query again, now that entity fields are searched with
        // num_typos: 0 — see CHARTS_FIELDS. It briefly wasn't, because
        // "malaria" fuzzy-matched the countries "Malawi" and "Malaysia".
        it("rescues a query with no exact match via closest matches", async () => {
            const response = await workerFetch(
                "/api/search?type=charts&q=deforestation%20brazil%20amazon%20rate"
            )
            expect(response.status).toBe(200)

            const body = (await response.json()) as {
                results: unknown[]
                nbHits: number
                closestMatches?: boolean
            }
            expect(body.closestMatches).toBe(true)
            expect(body.results.length).toBeGreaterThan(0)
            expect(body.nbHits).toBeGreaterThan(0)
        })

        it('stays honestly empty for a non-distinctive query ("world cup")', async () => {
            const response = await workerFetch(
                "/api/search?type=charts&q=world%20cup"
            )
            expect(response.status).toBe(200)

            const body = (await response.json()) as {
                results: unknown[]
                nbHits: number
                closestMatches?: boolean
            }
            expect(body.closestMatches).toBeUndefined()
            expect(body.results).toEqual([])
            expect(body.nbHits).toBe(0)
        })
    }
)
