import path from "node:path"
import { readFileSync } from "node:fs"
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest"
import { unstable_startWorker } from "wrangler"
import { R2GrapherConfigDirectory } from "@ourworldindata/types"

let worker: Awaited<ReturnType<typeof unstable_startWorker>>

const lifeExpectancyFixturePath = path.join(
    process.cwd(),
    "functions/test/fixtures/life-expectancy.config.json"
)
const lifeExpectancyFixture = readFileSync(lifeExpectancyFixturePath, "utf8")

function makeSlugKey(slug: string, bucketPath = "v1"): string {
    return [
        bucketPath,
        R2GrapherConfigDirectory.publishedGrapherBySlug,
        `${slug}.json`,
    ].join("/")
}

async function workerFetch(pathname: string, init?: unknown) {
    return worker.fetch(`http://example.com${pathname}`, init as never)
}

async function clearBuckets() {
    const response = await workerFetch("/__test__/clear-r2", { method: "POST" })
    expect(response.status).toBe(200)
}

async function seedR2(params: {
    bucket: "primary" | "fallback"
    key: string
    value: string
}) {
    const response = await workerFetch("/__test__/seed-r2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...params,
            contentType: "application/json",
        }),
    })
    expect(response.status).toBe(200)
}

async function r2HasKey(params: {
    bucket: "primary" | "fallback"
    key: string
}) {
    const response = await workerFetch(
        `/__test__/r2-has-key?bucket=${params.bucket}&key=${encodeURIComponent(
            params.key
        )}`
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { exists: boolean }
    return body.exists
}

describe("grapher config endpoint with local R2 bindings", () => {
    beforeAll(async () => {
        worker = await unstable_startWorker({
            config: "./functions/test/wrangler.e2e.jsonc",
            dev: { logLevel: "none" },
        })
    })

    afterAll(async () => {
        await worker.dispose()
    })

    beforeEach(async () => {
        await clearBuckets()
    })

    it("returns grapher config from primary R2 bucket", async () => {
        const key = makeSlugKey("life-expectancy")
        await seedR2({
            bucket: "primary",
            key,
            value: lifeExpectancyFixture,
        })

        const response = await workerFetch(
            "/grapher/life-expectancy.config.json"
        )
        expect(response.status).toBe(200)
        expect(response.headers.get("Content-Type")).toBe("application/json")
        expect(response.headers.get("ETag")).toBeTruthy()

        const config = (await response.json()) as {
            slug?: string
            title?: string
        }
        expect(config.slug).toBe("life-expectancy")
        expect(config.title).toBe("Life expectancy")
    })

    it("returns 304 when If-None-Match matches current config", async () => {
        const key = makeSlugKey("life-expectancy")
        await seedR2({
            bucket: "primary",
            key,
            value: lifeExpectancyFixture,
        })

        const first = await workerFetch("/grapher/life-expectancy.config.json")
        expect(first.status).toBe(200)
        const etag = first.headers.get("ETag")
        expect(etag).toBeTruthy()

        const second = await workerFetch(
            "/grapher/life-expectancy.config.json",
            {
                headers: { "If-None-Match": etag as string },
            }
        )
        expect(second.status).toBe(304)
    })

    it("falls back to fallback R2 bucket when primary misses", async () => {
        const key = makeSlugKey("life-expectancy")
        await seedR2({
            bucket: "fallback",
            key,
            value: lifeExpectancyFixture,
        })

        expect(await r2HasKey({ bucket: "primary", key })).toBe(false)
        expect(await r2HasKey({ bucket: "fallback", key })).toBe(true)

        const response = await workerFetch(
            "/grapher/life-expectancy.config.json"
        )
        expect(response.status).toBe(200)

        const config = (await response.json()) as {
            slug?: string
            title?: string
        }
        expect(config.slug).toBe("life-expectancy")
        expect(config.title).toBe("Life expectancy")
    })

    it("returns 404 when config is missing from both buckets", async () => {
        const response = await workerFetch(
            "/grapher/definitely-not-a-real-chart.config.json"
        )
        expect(response.status).toBe(404)
    })

    it("sets no-cache when nocache query param is present", async () => {
        const key = makeSlugKey("life-expectancy")
        await seedR2({
            bucket: "primary",
            key,
            value: lifeExpectancyFixture,
        })

        const response = await workerFetch(
            "/grapher/life-expectancy.config.json?nocache=1"
        )
        expect(response.status).toBe(200)
        expect(response.headers.get("Cache-Control")).toBe("no-cache")
    })
})
