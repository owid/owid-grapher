import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartConfigsTableName,
    GrapherInterface,
    IndicatorsBeforePreProcessing,
    MultiDimDataPageConfigEnriched,
    MultiDimDataPagesTableName,
    MultiDimViewDimensionsTableName,
    MultiDimXChartConfigsTableName,
    View,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import {
    otherVariableId,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"

const env = getAdminTestEnv()

describe("Multi-dim views", { timeout: 20000 }, () => {
    const catalogPath = "test/catalog#path"

    const totalView: View<IndicatorsBeforePreProcessing> = {
        config: { title: "Total energy use" },
        dimensions: { metric: "total" },
        indicators: { y: variableId },
    }
    const perCapitaView: View<IndicatorsBeforePreProcessing> = {
        config: { title: "Energy use per capita" },
        dimensions: { metric: "per_capita" },
        indicators: { y: otherVariableId },
    }

    function multiDimConfig(
        views: View<IndicatorsBeforePreProcessing>[],
        grapherConfigSchema: string | undefined
    ): object {
        return {
            ...(grapherConfigSchema ? { grapherConfigSchema } : {}),
            title: { title: "Energy use", titleVariant: "by energy source" },
            views,
            dimensions: [
                {
                    name: "Metric",
                    slug: "metric",
                    choices: views.map((view) => ({
                        name: view.dimensions.metric,
                        slug: view.dimensions.metric,
                    })),
                },
            ],
        }
    }

    async function upsertMultiDim(
        views: View<IndicatorsBeforePreProcessing>[],
        grapherConfigSchema: string | undefined = latestGrapherConfigSchema
    ): Promise<void> {
        await env.request({
            method: "PUT",
            path: `/multi-dims/${encodeURIComponent(catalogPath)}`,
            body: JSON.stringify({
                config: multiDimConfig(views, grapherConfigSchema),
            }),
        })
    }

    /** Maps each view's id (e.g. "metric=total") to its chart config id. */
    async function getViewConfigIds(): Promise<Record<string, string>> {
        const rows = await env
            .testKnex(MultiDimXChartConfigsTableName)
            .select("viewId", "chartConfigId")
        return Object.fromEntries(
            rows.map((row) => [row.viewId, row.chartConfigId])
        )
    }

    async function getConfig(chartConfigId: string): Promise<GrapherInterface> {
        const row = await env
            .testKnex(ChartConfigsTableName)
            .where({ id: chartConfigId })
            .first()
        return JSON.parse(row.config)
    }

    async function getMultiDimConfig(): Promise<MultiDimDataPageConfigEnriched> {
        const row = await env
            .testKnex(MultiDimDataPagesTableName)
            .where({ catalogPath })
            .first()
        return JSON.parse(row.config)
    }

    async function publishMultiDim(): Promise<void> {
        const multiDim = await env
            .testKnex(MultiDimDataPagesTableName)
            .where({ catalogPath })
            .first()
        await env.request({
            method: "PATCH",
            path: `/multi-dims/${multiDim.id}`,
            body: JSON.stringify({ published: true, slug: "energy-use" }),
        })
    }

    beforeEach(async () => {
        await seedDatasetAndVariables(env)
    })

    it("creates a config row and a dimensions row per view", async () => {
        await upsertMultiDim([totalView, perCapitaView])

        expect(await env.getCount(MultiDimXChartConfigsTableName)).toBe(2)
        expect(await env.getCount(ChartConfigsTableName)).toBe(2)
        expect(await env.getCount(MultiDimViewDimensionsTableName)).toBe(2)

        const viewConfigIds = await getViewConfigIds()
        expect(Object.keys(viewConfigIds).sort()).toEqual([
            "metric=per_capita",
            "metric=total",
        ])

        const config = await getConfig(viewConfigIds["metric=total"])
        expect(config.title).toBe("Total energy use")
        expect(config.dimensions).toEqual([{ property: "y", variableId }])
    })

    it("migrates view configs to the latest schema version", async () => {
        const outdatedSchema =
            "https://files.ourworldindata.org/schemas/grapher-schema.005.json"
        const outdatedView = {
            ...totalView,
            // hideLegend was renamed to hideSeriesLabels in version 010
            config: {
                ...totalView.config,
                hideLegend: true,
            } as GrapherInterface,
        }
        await upsertMultiDim([outdatedView], outdatedSchema)

        const config = await getMultiDimConfig()
        expect(config.grapherConfigSchema).toBe(latestGrapherConfigSchema)
        expect(config.views[0].config).toEqual({
            $schema: latestGrapherConfigSchema,
            title: "Total energy use",
            hideSeriesLabels: true,
        })
    })

    it("versions view configs that declare no schema", async () => {
        await upsertMultiDim([totalView], undefined)

        const config = await getMultiDimConfig()
        expect(config.grapherConfigSchema).toBe(latestGrapherConfigSchema)
        expect(config.views[0].config?.$schema).toBe(latestGrapherConfigSchema)
    })

    it("drops the config row of a removed view and keeps the rest", async () => {
        await upsertMultiDim([totalView, perCapitaView])
        const before = await getViewConfigIds()

        await upsertMultiDim([totalView])

        const after = await getViewConfigIds()
        expect(Object.keys(after)).toEqual(["metric=total"])
        // The surviving view keeps its config id, which is a public identity
        expect(after["metric=total"]).toBe(before["metric=total"])
        expect(await env.getCount(ChartConfigsTableName)).toBe(1)

        // multi_dim_view_dimensions is an append-only log for analytics: its row
        // for the removed view deliberately outlives the config it names, so a
        // GA event carrying that config id can still be resolved.
        expect(await env.getCount(MultiDimViewDimensionsTableName)).toBe(2)
    })

    it("re-merges view configs when the indicator's ETL config changes", async () => {
        await upsertMultiDim([totalView, perCapitaView])
        const viewConfigIds = await getViewConfigIds()

        // The multi-dim was created before the indicator had a config, so this only
        // reaches the views through the propagation path
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                note: "Indicator note",
                hasMapTab: true,
            }),
        })

        // The view built on that indicator inherits the new keys…
        const config = await getConfig(viewConfigIds["metric=total"])
        expect(config.note).toBe("Indicator note")
        expect(config.hasMapTab).toBe(true)
        // …without losing what the multi-dim itself authored
        expect(config.title).toBe("Total energy use")

        // The other view is built on a different indicator and is untouched
        const otherConfig = await getConfig(viewConfigIds["metric=per_capita"])
        expect(otherConfig).not.toHaveProperty("note")
        expect(otherConfig.title).toBe("Energy use per capita")

        // Propagation updates the rows in place rather than replacing them
        expect(await getViewConfigIds()).toEqual(viewConfigIds)
    })

    it("publishes every view, and they stay published through an indicator change", async () => {
        await upsertMultiDim([totalView, perCapitaView])
        const viewConfigIds = await getViewConfigIds()

        await publishMultiDim()

        for (const chartConfigId of Object.values(viewConfigIds)) {
            expect((await getConfig(chartConfigId)).isPublished).toBe(true)
        }

        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                note: "Indicator note",
            }),
        })

        const config = await getConfig(viewConfigIds["metric=total"])
        expect(config.isPublished).toBe(true)
        expect(config.note).toBe("Indicator note")
    })
})
