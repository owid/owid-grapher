import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import { ChartConfigsTableName } from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { formatGrapherSchemaUrl } from "@ourworldindata/utils"
import { ChartConfigValidationResult } from "../apiRoutes/chartConfigs.js"

const env = getAdminTestEnv()

describe("POST /chart-configs/validate", { timeout: 15000 }, () => {
    const testChartConfig = {
        $schema: latestGrapherConfigSchema,
        slug: "test-chart",
        title: "Test chart",
        chartTypes: ["LineChart"],
        dimensions: [{ property: "y", variableId: 1 }],
    }

    it("reports a single valid config as valid", async () => {
        const response = await env.request({
            method: "POST",
            path: "/chart-configs/validate",
            body: JSON.stringify({ configs: [testChartConfig] }),
        })
        expect(response.results).toHaveLength(1)
        expect(response.results[0].isValid).toBe(true)
    })

    it("reports each config in a mixed batch independently, without failing the request", async () => {
        const configWithUnknownKey = { ...testChartConfig, hideLegend: true }
        const configWithoutSchema = { title: "No schema here" }

        const response = await env.request({
            method: "POST",
            path: "/chart-configs/validate",
            body: JSON.stringify({
                configs: [
                    testChartConfig,
                    configWithUnknownKey,
                    configWithoutSchema,
                    42,
                ],
            }),
        })

        const results: ChartConfigValidationResult[] = response.results
        expect(results.map((result) => result.isValid)).toEqual([
            true,
            false,
            false,
            false,
        ])
        expect(response.results[1].issues[0].pointer).toBe("/hideLegend")
        expect(response.results[2].issues[0].pointer).toBe("/$schema")
        expect(response.results[3].issues[0]).toEqual({
            pointer: "",
            message: "must be object",
        })
    })

    it("reports a config at an older schema version as valid once migrated", async () => {
        const outdatedConfig = {
            ...testChartConfig,
            $schema: formatGrapherSchemaUrl("010"),
            dimensions: [
                { property: "y", variableId: 1, display: { yearIsDay: true } },
            ],
        }

        const response = await env.request({
            method: "POST",
            path: "/chart-configs/validate",
            body: JSON.stringify({ configs: [outdatedConfig] }),
        })
        expect(response.results[0].isValid).toBe(true)
    })

    it("answers an empty batch with an empty result list", async () => {
        const response = await env.request({
            method: "POST",
            path: "/chart-configs/validate",
            body: JSON.stringify({ configs: [] }),
        })
        expect(response.results).toEqual([])
    })

    it("persists nothing", async () => {
        const countBefore = await env.getCount(ChartConfigsTableName)
        await env.request({
            method: "POST",
            path: "/chart-configs/validate",
            body: JSON.stringify({
                configs: [testChartConfig, testChartConfig],
            }),
        })
        expect(await env.getCount(ChartConfigsTableName)).toBe(countBefore)
    })
})
