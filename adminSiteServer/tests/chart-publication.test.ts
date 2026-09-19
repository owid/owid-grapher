import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest"
import { knexReadWriteTransaction } from "../../db/db.js"
import { updateGrapherConfigsInR2 } from "../apiRoutes/variables.js"
import { createTestHarness } from "wrangler"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { DimensionProperty, GrapherInterface } from "@ourworldindata/types"
import { getAdminTestEnv } from "./testEnv.js"
import {
    catalogPath,
    multiDimConfig,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"
import {
    saveObjectToR2,
    deleteObjectFromR2,
} from "../../serverUtils/r2/R2Helpers.js"

vi.mock(import("../../settings/serverSettings.js"), async (original) => ({
    ...(await original()),
    GRAPHER_CONFIG_R2_BUCKET: "test-grapher-configs",
    GRAPHER_CONFIG_R2_BUCKET_PATH: "v1",
    R2_ENDPOINT: "https://storage.invalid",
    R2_ACCESS_KEY_ID: "test",
    R2_SECRET_ACCESS_KEY: "test",
}))
vi.mock(import("../../serverUtils/r2/R2Helpers.js"), async (original) => ({
    ...(await original()),
    saveObjectToR2: vi.fn(async () => undefined),
    deleteObjectFromR2: vi.fn(async () => undefined),
}))
vi.mock(import("../../baker/GrapherBakingUtils.js"), async (original) => ({
    ...(await original()),
    triggerStaticBuild: vi.fn(async () => undefined),
}))

const env = getAdminTestEnv()
const reader = createTestHarness({
    workers: [{ configPath: "./functions/test/wrangler.e2e.jsonc" }],
})
beforeAll(async () => {
    await reader.listen()
}, 60000)
afterAll(async () => {
    await reader.close()
}, 30000)
beforeEach(async () => {
    vi.mocked(saveObjectToR2).mockReset()
    vi.mocked(deleteObjectFromR2).mockReset()
    await seedDatasetAndVariables(env)
})

async function createChart(
    slug: string,
    published = true
): Promise<{ chartId: number; configId: string }> {
    const result = await env.request({
        method: "POST",
        path: "/charts?inheritance=enable",
        body: JSON.stringify({
            $schema: latestGrapherConfigSchema,
            title: "Standalone title",
            slug,
            isPublished: published,
            dimensions: [{ property: DimensionProperty.y, variableId }],
        }),
    })
    expect(result.success).toBe(true)
    const row = await env
        .testKnex("charts")
        .where({ id: result.chartId })
        .first("configId")
    return { chartId: result.chartId, configId: row.configId }
}

async function updateIndicator(note: string): Promise<void> {
    expect(
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                note,
                slug: "standalone",
                title: "Indicator title",
            }),
        })
    ).toMatchObject({ success: true })
}

function recordedObjects(): {
    key: string
    config: GrapherInterface
    raw: string
}[] {
    return vi
        .mocked(saveObjectToR2)
        .mock.calls.map(([content, bucket, key, contentType]) => {
            expect(bucket).toBe("test-grapher-configs")
            expect(contentType).toBe("application/json")
            return {
                key,
                config: JSON.parse(String(content)),
                raw: String(content),
            }
        })
}

describe("API configuration publication", () => {
    it("publishes inherited changes by UUID and standalone slug, excludes drafts, and delivers the actual output in Workers", async () => {
        const standalone = await createChart("standalone")
        await createChart("draft", false)
        await env.request({
            method: "PUT",
            path: `/multi-dims/${encodeURIComponent(catalogPath)}`,
            body: JSON.stringify({
                config: multiDimConfig([
                    {
                        dimensions: { metric: "total" },
                        indicators: { y: variableId },
                        config: {
                            title: "Multi-dimensional title",
                            slug: "standalone",
                        },
                    },
                ]),
            }),
        })
        const page = await env
            .testKnex("multi_dim_data_pages")
            .where({ catalogPath })
            .first()
        await env.request({
            method: "PATCH",
            path: `/multi-dims/${page.id}`,
            body: JSON.stringify({
                published: true,
                slug: "multi-dimensional",
            }),
        })
        const view = await env
            .testKnex("multi_dim_x_chart_configs")
            .where({ multiDimId: page.id })
            .first()
        vi.mocked(saveObjectToR2).mockClear()
        await updateIndicator("Updated inherited note")
        const objects = recordedObjects()
        expect(objects.map(({ key }) => key).sort()).toEqual(
            [
                `v1/config/by-uuid/${standalone.configId}.json`,
                `v1/config/by-uuid/${view.chartConfigId}.json`,
                "v1/config/by-slug-published/standalone.json",
            ].sort()
        )
        for (const object of objects) {
            expect(object.config.note).toBe("Updated inherited note")
            expect(object.config.title).toBe(
                object.key.includes(view.chartConfigId)
                    ? "Multi-dimensional title"
                    : "Standalone title"
            )
            expect(object.config.dimensions).toEqual([
                { property: "y", variableId },
            ])
            const seeded = await reader.fetch("/__test__/seed-r2", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bucket: "primary",
                    key: object.key,
                    value: object.raw,
                    contentType: "application/json",
                }),
            })
            expect(seeded.status).toBe(200)
        }
        const delivered = await reader.fetch("/grapher/standalone.config.json")
        expect(delivered.status).toBe(200)
        expect(await delivered.json()).toMatchObject({
            title: "Standalone title",
            note: "Updated inherited note",
        })
        expect(delivered.headers.get("ETag")).toBeTruthy()
        expect(delivered.headers.get("Cache-Control")).toBeTruthy()

        // Historical or externally written configs may carry a slug. Storage ownership must
        // not rely on the current reconstruction sanitizing that field away.
        vi.mocked(saveObjectToR2).mockClear()
        await knexReadWriteTransaction(async (trx) => {
            const config = {
                $schema: latestGrapherConfigSchema,
                title: "Stored multidimensional view",
                slug: "standalone",
            }
            await trx("chart_configs")
                .where({ id: view.chartConfigId })
                .update({ config: JSON.stringify(config) })
            await updateGrapherConfigsInR2(
                trx,
                [],
                [{ chartConfigId: view.chartConfigId, isPublished: true }]
            )
        })
        expect(
            recordedObjects().map(({ key, config }) => ({
                key,
                title: config.title,
                slug: config.slug,
            }))
        ).toEqual([
            {
                key: `v1/config/by-uuid/${view.chartConfigId}.json`,
                title: "Stored multidimensional view",
                slug: "standalone",
            },
        ])
    })

    it("removes the old slug on rename and the public slug on unpublication", async () => {
        const chart = await createChart("standalone")
        const config = await env.fetchJson(
            `/charts/${chart.chartId}.config.json`
        )
        vi.mocked(saveObjectToR2).mockClear()
        vi.mocked(deleteObjectFromR2).mockClear()
        await env.request({
            method: "PUT",
            path: `/charts/${chart.chartId}`,
            body: JSON.stringify({ ...config, slug: "renamed" }),
        })
        expect(
            vi.mocked(deleteObjectFromR2).mock.calls.map(([, key]) => key)
        ).toContain("v1/config/by-slug-published/standalone.json")
        expect(recordedObjects().map(({ key }) => key)).toContain(
            "v1/config/by-slug-published/renamed.json"
        )
        expect(
            await env
                .testKnex("chart_slug_redirects")
                .where({ chart_id: chart.chartId })
                .select("slug")
        ).toEqual([{ slug: "standalone" }])
        vi.mocked(deleteObjectFromR2).mockClear()
        await env.request({
            method: "PUT",
            path: `/charts/${chart.chartId}`,
            body: JSON.stringify({
                ...config,
                slug: "renamed",
                isPublished: false,
            }),
        })
        expect(
            vi.mocked(deleteObjectFromR2).mock.calls.map(([, key]) => key)
        ).toContain("v1/config/by-slug-published/renamed.json")
        expect(
            (await env.fetchJson(`/charts/${chart.chartId}.config.json`))
                .isPublished
        ).toBe(false)
    })
    // Current contract: the API rejects and rolls SQL back; completed storage writes cannot be rolled back.
    // Fail the first write so this case makes no atomicity claim about partial publication.
    it("rejects an indicator update and retains the previous DB config when the first storage write fails", async () => {
        const chart = await createChart("standalone")
        await updateIndicator("Previous note")
        vi.mocked(saveObjectToR2).mockRejectedValueOnce(
            new Error("Storage unavailable")
        )
        const response = await fetch(
            `${env.baseUrl}/variables/${variableId}/grapherConfigETL`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${env.apiKey}`,
                },
                body: JSON.stringify({
                    $schema: latestGrapherConfigSchema,
                    note: "Unsaved note",
                }),
            }
        )
        expect(response.status).toBe(500)
        expect(
            (await env.fetchJson(`/charts/${chart.chartId}.config.json`)).note
        ).toBe("Previous note")
        expect(
            (await env.fetchJson(`/variables/${variableId}.config.json`)).note
        ).toBe("Previous note")
    })
})
