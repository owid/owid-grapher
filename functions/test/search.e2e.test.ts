import { beforeAll, afterAll, describe, expect, it } from "vitest"
import { unstable_startWorker } from "wrangler"

let worker: Awaited<ReturnType<typeof unstable_startWorker>>

async function workerFetch(pathname: string) {
    return worker.fetch(`http://example.com${pathname}`)
}

// Runs the real /api/search handler inside an actual Workers (workerd)
// runtime, unlike searchApi.integration.test.ts which exercises the same
// code under Node. This is what actually proves the algoliasearch `liteClient`
// + fetch requester combination — not just the raw REST fetch it replaced —
// works in the runtime it's deployed to.
describe("search endpoint inside a real Workers runtime", () => {
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
})
