import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartConfigsTableName,
    GrapherInterface,
    MultiDimXChartConfigsTableName,
    NarrativeChartsTableName,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { seedDatasetAndVariables, variableId } from "./fixtures.js"
import type { NarrativeChartResponse } from "../apiRoutes/narrativeCharts.js"

const env = getAdminTestEnv()

describe("Narrative charts API", { timeout: 20000 }, () => {
    const parentChartConfig: GrapherInterface = {
        $schema: latestGrapherConfigSchema,
        slug: "parent-chart",
        title: "Parent title",
        subtitle: "Parent subtitle",
        chartTypes: ["LineChart"],
        selectedEntityNames: ["France"],
    }

    // What the narrative chart editor submits: the parent's config with a
    // single override. Everything else should be inherited, not stored.
    const narrativeChartConfig: GrapherInterface = {
        ...parentChartConfig,
        title: "Narrative title",
    }

    const catalogPath = "test/catalog#path"
    const testMultiDimConfig = {
        grapherConfigSchema: latestGrapherConfigSchema,
        title: { title: "Energy use", titleVariant: "by energy source" },
        views: [
            {
                config: { title: "Total energy use" },
                dimensions: { metric: "total" },
                indicators: { y: variableId },
            },
        ],
        dimensions: [
            {
                name: "Metric",
                slug: "metric",
                choices: [{ name: "Total consumption", slug: "total" }],
            },
        ],
    }

    async function createParentChart(): Promise<{
        chartId: number
        config: GrapherInterface
    }> {
        const { chartId } = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(parentChartConfig),
        })
        const config = await env.fetchJson(`/charts/${chartId}.config.json`)
        return { chartId, config }
    }

    async function createNarrativeChart(
        parentChartId: number,
        config: GrapherInterface = narrativeChartConfig
    ): Promise<number> {
        const { narrativeChartId } = await env.request({
            method: "POST",
            path: "/narrative-charts",
            body: JSON.stringify({
                type: "chart",
                name: "test-narrative-chart",
                parentChartId,
                config,
            }),
        })
        return narrativeChartId
    }

    function getNarrativeChart(
        id: number
    ): Promise<
        Omit<NarrativeChartResponse, "updatedAt"> & { updatedAt: string }
    > {
        return env.fetchJson(`/narrative-charts/${id}.config.json`)
    }

    it("creates a narrative chart from a parent chart", async () => {
        const { chartId, config: parentConfig } = await createParentChart()
        const narrativeChartId = await createNarrativeChart(chartId)

        expect(await env.getCount(NarrativeChartsTableName)).toBe(1)
        expect(await env.getCount(ChartConfigsTableName)).toBe(2)

        const narrativeChart = await getNarrativeChart(narrativeChartId)
        expect(narrativeChart.parentType).toBe("chart")
        expect(narrativeChart.parentConfigFull).toEqual(parentConfig)

        // The authored layer keeps the override, and the props that are always
        // persisted so a parent edit can never move them — even though they are
        // identical to the parent's here
        expect(narrativeChart.configPatch).toMatchObject({
            title: "Narrative title",
            chartTypes: ["LineChart"],
            selectedEntityNames: ["France"],
        })
        // …but not what it inherits, nor the props narrative charts never own
        expect(narrativeChart.configPatch).not.toHaveProperty("subtitle")
        for (const prop of ["id", "isPublished", "slug", "version"]) {
            expect(narrativeChart.configPatch).not.toHaveProperty(prop)
        }

        // The served config is the authored layer over the parent: the title
        // is the narrative chart's, the subtitle comes from the parent, and the
        // time/tab/focus props come from the default layer via the props that
        // are always persisted
        expect(narrativeChart.configFull).toEqual({
            $schema: latestGrapherConfigSchema,
            title: "Narrative title",
            subtitle: "Parent subtitle",
            chartTypes: ["LineChart"],
            selectedEntityNames: ["France"],
            tab: "chart",
            minTime: "earliest",
            maxTime: "latest",
            focusedSeriesNames: [],
        })
    })

    it("creates a narrative chart from a multi-dim view", async () => {
        await seedDatasetAndVariables(env)
        await env.request({
            method: "PUT",
            path: `/multi-dims/${encodeURIComponent(catalogPath)}`,
            body: JSON.stringify({ config: testMultiDimConfig }),
        })
        const view = await env.testKnex(MultiDimXChartConfigsTableName).first()

        const { narrativeChartId } = await env.request({
            method: "POST",
            path: "/narrative-charts",
            body: JSON.stringify({
                type: "multiDim",
                name: "test-narrative-chart-from-view",
                parentChartConfigId: view.chartConfigId,
                config: {
                    $schema: latestGrapherConfigSchema,
                    title: "Narrative title",
                    chartTypes: ["LineChart"],
                    selectedEntityNames: [],
                },
            }),
        })

        const narrativeChart = await getNarrativeChart(narrativeChartId)
        expect(narrativeChart.parentType).toBe("multiDim")
        expect(narrativeChart.configFull).toEqual({
            $schema: latestGrapherConfigSchema,
            title: "Narrative title",
            // inherited from the view, which got it from the multi-dim config
            dimensions: [{ property: "y", variableId }],
            chartTypes: ["LineChart"],
            selectedEntityNames: [],
            tab: "chart",
            minTime: "earliest",
            maxTime: "latest",
            focusedSeriesNames: [],
        })
    })

    it("updates a narrative chart in place", async () => {
        const { chartId } = await createParentChart()
        const narrativeChartId = await createNarrativeChart(chartId)
        const before = await getNarrativeChart(narrativeChartId)

        await env.request({
            method: "PUT",
            path: `/narrative-charts/${narrativeChartId}`,
            body: JSON.stringify({
                config: { ...narrativeChartConfig, title: "Updated title" },
            }),
        })

        const after = await getNarrativeChart(narrativeChartId)
        expect(after.chartConfigId).toBe(before.chartConfigId)
        expect(after.configFull.title).toBe("Updated title")
        expect(await env.getCount(ChartConfigsTableName)).toBe(2)
    })

    it("does not re-merge a narrative chart when its parent chart changes", async () => {
        const { chartId } = await createParentChart()
        const narrativeChartId = await createNarrativeChart(chartId)

        await env.request({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify({
                ...parentChartConfig,
                subtitle: "Updated parent subtitle",
            }),
        })

        const narrativeChart = await getNarrativeChart(narrativeChartId)
        expect(narrativeChart.parentConfigFull.subtitle).toBe(
            "Updated parent subtitle"
        )
        expect(narrativeChart.configFull.subtitle).toBe("Parent subtitle")
    })

    it("deletes a narrative chart and its configs", async () => {
        const { chartId } = await createParentChart()
        const narrativeChartId = await createNarrativeChart(chartId)
        expect(await env.getCount(ChartConfigsTableName)).toBe(2)

        await env.request({
            method: "DELETE",
            path: `/narrative-charts/${narrativeChartId}`,
        })

        expect(await env.getCount(NarrativeChartsTableName)).toBe(0)
        // Only the parent chart's config is left
        expect(await env.getCount(ChartConfigsTableName)).toBe(1)
    })
})
