import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartConfigsTableName,
    IndicatorsBeforePreProcessing,
    MultiDimXChartConfigsTableName,
    VariablesTableName,
    View,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import {
    datasetId,
    otherVariableId,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"

const env = getAdminTestEnv()

async function cleanup(keepVariableIds: number[]): Promise<any> {
    return await env.request({
        method: "POST",
        path: `/datasets/${datasetId}/cleanupGhostVariables`,
        body: JSON.stringify({ keepVariableIds }),
    })
}

async function remainingVariableIds(): Promise<number[]> {
    const rows = await env
        .testKnex(VariablesTableName)
        .where({ datasetId })
        .pluck("id")
    return rows.sort((a: number, b: number) => a - b)
}

describe("Ghost variable cleanup", { timeout: 15000 }, () => {
    beforeEach(async () => {
        await seedDatasetAndVariables(env)
    })

    it("deletes the variables that weren't upserted and keeps the rest", async () => {
        const response = await cleanup([variableId])

        expect(response.deleted).toEqual([otherVariableId])
        expect(response.blocked).toEqual([])
        expect(await remainingVariableIds()).toEqual([variableId])
    })

    it("deletes every variable when none were upserted", async () => {
        const response = await cleanup([])

        expect(response.deleted.sort()).toEqual([variableId, otherVariableId])
        expect(await remainingVariableIds()).toEqual([])
    })

    it("is a no-op when every variable was upserted", async () => {
        const response = await cleanup([variableId, otherVariableId])

        expect(response.deleted).toEqual([])
        expect(response.blocked).toEqual([])
        expect(await remainingVariableIds()).toEqual([
            variableId,
            otherVariableId,
        ])
    })

    it("reports variables used by a chart as blocked instead of deleting them", async () => {
        const { chartId } = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "ghost-variable-chart",
                title: "Chart using a ghost variable",
                chartTypes: ["LineChart"],
                dimensions: [{ property: "y", variableId: otherVariableId }],
            }),
        })

        const response = await cleanup([variableId])

        expect(response.deleted).toEqual([])
        expect(response.blocked).toEqual([
            {
                variableId: otherVariableId,
                variableName: null,
                chartId,
                chartSlug: "ghost-variable-chart",
            },
        ])
        // The blocked variable survives — deciding whether that should fail the ETL
        // run is the caller's job, not ours.
        expect(await remainingVariableIds()).toEqual([
            variableId,
            otherVariableId,
        ])
    })

    it("deletes a ghost variable's leftover chart config", async () => {
        await env.request({
            method: "PUT",
            path: `/variables/${otherVariableId}/grapherConfigETL`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                title: "Indicator-level config",
            }),
        })
        expect(await env.getCount(ChartConfigsTableName)).toBe(1)

        const response = await cleanup([variableId])

        expect(response.deleted).toEqual([otherVariableId])
        expect(await env.getCount(ChartConfigsTableName)).toBe(0)
    })

    it("deletes the mdim view configs that go with a ghost variable", async () => {
        // Predecessor of this endpoint, which found the leak: owid/etl#6672.
        const catalogPath = "test/catalog#path"
        const views: View<IndicatorsBeforePreProcessing>[] = [
            {
                config: { title: "Kept view" },
                dimensions: { metric: "total" },
                indicators: { y: variableId },
            },
            {
                config: { title: "Ghost view" },
                dimensions: { metric: "per_capita" },
                indicators: { y: otherVariableId },
            },
        ]
        await env.request({
            method: "PUT",
            path: `/multi-dims/${encodeURIComponent(catalogPath)}`,
            body: JSON.stringify({
                config: {
                    grapherConfigSchema: latestGrapherConfigSchema,
                    title: { title: "Energy use" },
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
                },
            }),
        })
        const configCountBefore = await env.getCount(ChartConfigsTableName)
        expect(await env.getCount(MultiDimXChartConfigsTableName)).toBe(2)

        const response = await cleanup([variableId])

        expect(response.deleted).toEqual([otherVariableId])
        expect(await env.getCount(MultiDimXChartConfigsTableName)).toBe(1)
        // The ghost view's config goes with its link row instead of being stranded.
        expect(await env.getCount(ChartConfigsTableName)).toBe(
            configCountBefore - 1
        )
    })
})
