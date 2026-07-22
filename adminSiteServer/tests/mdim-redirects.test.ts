import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    DatasetsTableName,
    VariablesTableName,
    MultiDimDataPagesTableName,
    MultiDimRedirectsTableName,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"

const env = getAdminTestEnv()

describe("Bulk multi-dim redirects API", { timeout: 30000 }, () => {
    const variableId = 1
    const otherVariableId = 2
    const catalogPath = "test/catalog#path"

    const dummyDataset = {
        id: 1,
        name: "Dummy dataset",
        description: "Dataset description",
        namespace: "owid",
        createdByUserId: 1,
        metadataEditedAt: new Date(),
        metadataEditedByUserId: 1,
        dataEditedAt: new Date(),
        dataEditedByUserId: 1,
    }
    const dummyVariable = {
        id: variableId,
        unit: "kg",
        coverage: "Global by country",
        timespan: "2000-2020",
        datasetId: 1,
        display: '{ "unit": "kg", "shortUnit": "kg" }',
    }
    const otherDummyVariable = { ...dummyVariable, id: otherVariableId }

    const testMultiDimConfig = {
        grapherConfigSchema: latestGrapherConfigSchema,
        title: { title: "Energy use", titleVariant: "by energy source" },
        views: [
            {
                config: { title: "Total energy use" },
                dimensions: { source: "all", metric: "total" },
                indicators: { y: variableId },
            },
            {
                dimensions: { source: "all", metric: "per_capita" },
                indicators: { y: otherVariableId },
            },
        ],
        dimensions: [
            {
                name: "Energy source",
                slug: "source",
                choices: [{ name: "All sources", slug: "all" }],
            },
            {
                name: "Metric",
                slug: "metric",
                choices: [
                    { name: "Total consumption", slug: "total" },
                    { name: "Consumption per capita", slug: "per_capita" },
                ],
            },
        ],
    }

    // Publishes the test multi-dim under a slug and returns its DB row.
    async function createPublishedMultiDim(): Promise<{
        id: number
        config: any
    }> {
        await env.request({
            method: "PUT",
            path: `/multi-dims/${encodeURIComponent(catalogPath)}`,
            body: JSON.stringify({ config: testMultiDimConfig }),
        })
        await env
            .testKnex(MultiDimDataPagesTableName)
            .where("catalogPath", catalogPath)
            .update({ slug: "energy-use", published: true })
        const mdim = await env
            .testKnex(MultiDimDataPagesTableName)
            .where("catalogPath", catalogPath)
            .first()
        return { id: mdim.id, config: JSON.parse(mdim.config) }
    }

    beforeEach(async () => {
        await env.testKnex(DatasetsTableName).insert([dummyDataset])
        await env
            .testKnex(VariablesTableName)
            .insert([dummyVariable, otherDummyVariable])
    })

    it("creates resolved redirects, skips null targets, and reports errors", async () => {
        const { id: multiDimId, config } = await createPublishedMultiDim()
        const totalView = config.views.find(
            (v: any) => v.dimensions.metric === "total"
        )
        const perCapitaView = config.views.find(
            (v: any) => v.dimensions.metric === "per_capita"
        )

        const body = {
            // extra top-level fields (mirroring the ETL mapping file) are ignored
            explorer: { slug: "energy" },
            stats: { total: 5 },
            redirects: [
                // resolved -> total view
                {
                    sourceViewId: 1,
                    source: {
                        explorerSlug: "energy",
                        dimensions: {
                            "Energy source": "All sources",
                            Metric: "Total consumption",
                        },
                    },
                    target: {
                        mdim: "energy",
                        catalogPath,
                        viewId: "ignored",
                        dimensions: { source: "all", metric: "total" },
                    },
                    sharedTargetSourceIds: [1],
                },
                // resolved -> per-capita view (same source path, different params)
                {
                    source: {
                        explorerSlug: "energy",
                        dimensions: {
                            "Energy source": "All sources",
                            Metric: "Consumption per capita",
                        },
                    },
                    target: {
                        catalogPath,
                        dimensions: { source: "all", metric: "per_capita" },
                    },
                },
                // unresolved -> skipped
                {
                    source: {
                        explorerSlug: "energy",
                        dimensions: { Metric: "Relative" },
                    },
                    target: null,
                    unresolvedReason: "No matching view",
                },
                // unknown catalog path -> error
                {
                    source: {
                        explorerSlug: "energy",
                        dimensions: { Metric: "Bogus" },
                    },
                    target: {
                        catalogPath: "does/not#exist",
                        dimensions: { source: "all", metric: "total" },
                    },
                },
                // dimensions match no view -> error
                {
                    source: {
                        explorerSlug: "energy",
                        dimensions: { Metric: "Unmatched" },
                    },
                    target: {
                        catalogPath,
                        dimensions: { source: "all", metric: "nonexistent" },
                    },
                },
            ],
        }

        const response = await env.request({
            method: "POST",
            path: "/multi-dim-redirects/bulk",
            body: JSON.stringify(body),
        })

        expect(response.success).toBe(true)
        expect(response.created).toBe(2)
        expect(response.skipped).toBe(1)
        expect(response.errors).toBe(2)

        const rows = await env
            .testKnex(MultiDimRedirectsTableName)
            .where("multiDimId", multiDimId)
            .orderBy("id")
        expect(rows).toHaveLength(2)

        const totalRedirect = rows.find(
            (r) => r.viewConfigId === totalView.fullConfigId
        )
        expect(totalRedirect).toBeDefined()
        expect(totalRedirect!.source).toBe("/explorers/energy")
        expect(JSON.parse(totalRedirect!.sourceQueryParams)).toEqual({
            "Energy source": "All sources",
            Metric: "Total consumption",
        })

        const perCapitaRedirect = rows.find(
            (r) => r.viewConfigId === perCapitaView.fullConfigId
        )
        expect(perCapitaRedirect).toBeDefined()
        expect(JSON.parse(perCapitaRedirect!.sourceQueryParams)).toEqual({
            "Energy source": "All sources",
            Metric: "Consumption per capita",
        })
    })

    it("errors on entries duplicating an existing redirect's source query params", async () => {
        await createPublishedMultiDim()
        const entry = {
            source: {
                explorerSlug: "energy",
                dimensions: {
                    "Energy source": "All sources",
                    Metric: "Total consumption",
                },
            },
            target: {
                catalogPath,
                dimensions: { source: "all", metric: "total" },
            },
        }
        // The same entry twice: the first creates, the second is a duplicate.
        const response = await env.request({
            method: "POST",
            path: "/multi-dim-redirects/bulk",
            body: JSON.stringify({ redirects: [entry, entry] }),
        })
        expect(response.created).toBe(1)
        expect(response.errors).toBe(1)
        expect(response.results[1].message).toMatch(/same source query params/)
    })
})
