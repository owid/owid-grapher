import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import { ChartConfigsTableName, ChartsTableName } from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"

const env = getAdminTestEnv()

describe("Charts API", { timeout: 15000 }, () => {
    const testChartConfig = {
        $schema: latestGrapherConfigSchema,
        slug: "test-chart",
        title: "Test chart",
        chartTypes: ["LineChart"],
    }

    it("creates, stores and reads chart configs", async () => {
        const chartCountBefore = await env.getCount(ChartsTableName)
        const chartConfigsCountBefore = await env.getCount(
            ChartConfigsTableName
        )
        expect(chartCountBefore).toBe(0)
        expect(chartConfigsCountBefore).toBe(0)

        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId
        expect(typeof chartId).toBe("number")

        const chartCountAfter = await env.getCount(ChartsTableName)
        expect(chartCountAfter).toBe(1)
        const chartConfigsCountAfter = await env.getCount(ChartConfigsTableName)
        expect(chartConfigsCountAfter).toBe(1)

        const parentConfig = (
            await env.fetchJson(`/charts/${chartId}.parent.json`)
        )?.config
        expect(parentConfig).toBeUndefined()

        const fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).toEqual({
            ...testChartConfig,
            id: chartId,
            version: 1,
            isPublished: false,
        })

        const patchConfig = await env.fetchJson(
            `/charts/${chartId}.patchConfig.json`
        )
        expect(patchConfig).toEqual(fullConfig)
    })
})
