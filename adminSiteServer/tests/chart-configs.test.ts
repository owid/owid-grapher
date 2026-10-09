import { describe, it, expect } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { ChartConfigValidationReport } from "../apiRoutes/chartConfigs.js"

const env = getAdminTestEnv()

describe("POST /chart-configs/validate", { timeout: 15000 }, () => {
    const testChartConfig = {
        $schema: latestGrapherConfigSchema,
        slug: "test-chart",
        title: "Test chart",
        chartTypes: ["LineChart"],
        dimensions: [{ property: "y", variableId: 1 }],
    }

    it("returns one result per config, even when some are invalid", async () => {
        const outdatedConfig = {
            ...testChartConfig,
            $schema:
                "https://files.ourworldindata.org/schemas/grapher-schema.010.json",
            dimensions: [
                { property: "y", variableId: 1, display: { yearIsDay: true } },
            ],
        }

        const response: ChartConfigValidationReport = await env.request({
            method: "POST",
            path: "/chart-configs/validate",
            body: JSON.stringify({
                configs: [
                    testChartConfig,
                    outdatedConfig,
                    { ...testChartConfig, hideLegend: true },
                    { title: "No schema here" },
                    42,
                ],
            }),
        })

        expect(response.results).toEqual([
            { isValid: true },
            { isValid: true },
            {
                isValid: false,
                issues: [
                    {
                        pointer: "/hideLegend",
                        message: "must NOT have additional properties",
                    },
                ],
            },
            {
                isValid: false,
                issues: [
                    {
                        pointer: "/$schema",
                        message: `must have a $schema; expected ${latestGrapherConfigSchema}`,
                    },
                ],
            },
            {
                isValid: false,
                issues: [{ pointer: "", message: "must be object" }],
            },
        ])
    })

    it("returns no results for an empty batch", async () => {
        const response = await env.request({
            method: "POST",
            path: "/chart-configs/validate",
            body: JSON.stringify({ configs: [] }),
        })
        expect(response.results).toEqual([])
    })

    it("rejects a request without a configs array", async () => {
        await env.request({
            method: "POST",
            path: "/chart-configs/validate",
            body: JSON.stringify([testChartConfig]),
            expectStatus: 400,
        })
    })
})
