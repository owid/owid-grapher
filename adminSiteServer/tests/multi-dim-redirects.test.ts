import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartSlugRedirectsTableName,
    MultiDimDataPagesTableName,
    MultiDimRedirectsTableName,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import {
    otherVariableId,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"

const env = getAdminTestEnv()

const catalogPath = "test/catalog#path"

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
    const multiDim = await env
        .testKnex(MultiDimDataPagesTableName)
        .where("catalogPath", catalogPath)
        .first()
    return { id: multiDim.id, config: JSON.parse(multiDim.config) }
}

describe("Bulk multi-dim redirects API", { timeout: 30000 }, () => {
    beforeEach(async () => {
        await seedDatasetAndVariables(env)
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

    it("creates a catch-all fallback redirect (default view, no source params)", async () => {
        const { id: multiDimId } = await createPublishedMultiDim()

        const response = await env.request({
            method: "POST",
            path: "/multi-dim-redirects/bulk",
            body: JSON.stringify({
                catchAll: {
                    source: { explorerSlug: "energy" },
                    target: { catalogPath, dimensions: {} },
                },
                redirects: [
                    {
                        source: {
                            explorerSlug: "energy",
                            dimensions: { Metric: "Total consumption" },
                        },
                        target: {
                            catalogPath,
                            dimensions: { source: "all", metric: "total" },
                        },
                    },
                ],
            }),
        })

        expect(response.created).toBe(2)
        expect(response.errors).toBe(0)

        const rows = await env
            .testKnex(MultiDimRedirectsTableName)
            .where("multiDimId", multiDimId)
        // The catch-all row: no source query params, default view.
        const catchAllRow = rows.find((r) => r.sourceQueryParams === null)
        expect(catchAllRow).toBeDefined()
        expect(catchAllRow!.source).toBe("/explorers/energy")
        expect(catchAllRow!.viewConfigId).toBeNull()
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

    it("errors every entry when the source is already a redirect target (batch-invariant chain check)", async () => {
        await createPublishedMultiDim()
        // A site redirect already points AT the explorer source, so turning it
        // into a redirect source would form a chain. This check depends only on
        // the source, so it must fail for every entry in the batch.
        await env.testKnex("redirects").insert({
            source: "/energy-launch",
            target: "/explorers/energy",
        })
        const makeEntry = (metricName: string, metricSlug: string) => ({
            source: {
                explorerSlug: "energy",
                dimensions: { Metric: metricName },
            },
            target: {
                catalogPath,
                dimensions: { source: "all", metric: metricSlug },
            },
        })
        const response = await env.request({
            method: "POST",
            path: "/multi-dim-redirects/bulk",
            body: JSON.stringify({
                redirects: [
                    makeEntry("Total consumption", "total"),
                    makeEntry("Consumption per capita", "per_capita"),
                ],
            }),
        })
        expect(response.created).toBe(0)
        expect(response.errors).toBe(2)
        for (const result of response.results) {
            expect(result.message).toMatch(/already a target/)
        }
    })
})

describe(
    "Multi-dim redirect from a redirect target",
    { timeout: 30000 },
    () => {
        beforeEach(async () => {
            await seedDatasetAndVariables(env)
        })

        // Creates a published chart at `slug` that used to be at `oldSlug`, so
        // `/grapher/${oldSlug}` is a chart slug redirect to `/grapher/${slug}`.
        async function createRenamedChart(
            oldSlug: string,
            slug: string
        ): Promise<number> {
            const config = {
                $schema: latestGrapherConfigSchema,
                slug: oldSlug,
                title: "Energy chart",
                chartTypes: ["LineChart"],
                isPublished: true,
            }
            const { chartId } = await env.request({
                method: "POST",
                path: "/charts",
                body: JSON.stringify(config),
            })
            await env.request({
                method: "PUT",
                path: `/charts/${chartId}`,
                body: JSON.stringify({ ...config, slug }),
            })
            return chartId
        }

        it("repoints the redirects to the source only when asked to", async () => {
            const { id: multiDimId, config } = await createPublishedMultiDim()
            const totalView = config.views.find(
                (v: any) => v.dimensions.metric === "total"
            )
            const chartId = await createRenamedChart(
                "old-energy",
                "energy-chart"
            )
            await env.testKnex("redirects").insert({
                source: "/energy-chart-launch",
                target: "/grapher/energy-chart",
            })
            const body = {
                source: "/grapher/energy-chart",
                viewConfigId: totalView.fullConfigId,
            }

            const { redirects } = await env.fetchJson(
                "/multi-dim-redirects/redirects-to?path=/grapher/energy-chart"
            )
            expect(redirects).toEqual([
                { kind: "site", source: "/energy-chart-launch" },
                { kind: "chartSlug", source: "/grapher/old-energy" },
            ])

            const rejected = await env.request({
                method: "POST",
                path: `/multi-dims/${multiDimId}/redirects`,
                body: JSON.stringify(body),
                expectStatus: 400,
            })
            expect(rejected.error.message).toMatch(
                /would form a redirect chain/
            )

            await env.request({
                method: "POST",
                path: `/multi-dims/${multiDimId}/redirects`,
                body: JSON.stringify({
                    ...body,
                    repointRedirectsToSource: true,
                }),
            })

            // Every old address now takes a single hop to the multi-dim view
            const multiDimRedirects = await env
                .testKnex(MultiDimRedirectsTableName)
                .where("multiDimId", multiDimId)
                .orderBy("source")
            expect(
                multiDimRedirects.map((r) => [r.source, r.viewConfigId])
            ).toEqual([
                ["/grapher/energy-chart", totalView.fullConfigId],
                ["/grapher/old-energy", totalView.fullConfigId],
            ])
            const siteRedirect = await env
                .testKnex("redirects")
                .where("source", "/energy-chart-launch")
                .first()
            expect(siteRedirect.target).toBe(
                "/grapher/energy-use?metric=total&source=all"
            )
            const chartSlugRedirects = await env
                .testKnex(ChartSlugRedirectsTableName)
                .where("chart_id", chartId)
            expect(chartSlugRedirects).toEqual([])
        })

        it("refuses to repoint for a redirect with source query params", async () => {
            const { id: multiDimId } = await createPublishedMultiDim()
            await env.testKnex("redirects").insert({
                source: "/energy-explorer-launch",
                target: "/explorers/energy",
            })
            await env.request({
                method: "POST",
                path: `/multi-dims/${multiDimId}/redirects`,
                body: JSON.stringify({
                    source: "/explorers/energy",
                    sourceQueryParams: { Metric: "Total consumption" },
                    repointRedirectsToSource: true,
                }),
                expectStatus: 400,
            })
            const siteRedirect = await env
                .testKnex("redirects")
                .where("source", "/energy-explorer-launch")
                .first()
            expect(siteRedirect.target).toBe("/explorers/energy")
        })
    }
)
