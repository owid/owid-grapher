import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartConfigsTableName,
    VariablesTableName,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import {
    datasetId,
    otherVariableId,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"

const env = getAdminTestEnv()

async function cleanup(body: {
    keepVariableIds: number[]
    dryRun?: boolean
}): Promise<any> {
    return await env.request({
        method: "POST",
        path: `/datasets/${datasetId}/cleanupGhostVariables`,
        body: JSON.stringify(body),
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
        const response = await cleanup({ keepVariableIds: [variableId] })

        expect(response.deleted).toEqual([otherVariableId])
        expect(response.blocked).toEqual([])
        expect(await remainingVariableIds()).toEqual([variableId])
    })

    it("deletes every variable when none were upserted", async () => {
        const response = await cleanup({ keepVariableIds: [] })

        expect(response.deleted.sort()).toEqual([variableId, otherVariableId])
        expect(await remainingVariableIds()).toEqual([])
    })

    it("is a no-op when every variable was upserted", async () => {
        const response = await cleanup({
            keepVariableIds: [variableId, otherVariableId],
        })

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

        const response = await cleanup({ keepVariableIds: [variableId] })

        expect(response.deleted).toEqual([])
        expect(response.blocked).toEqual([
            { variableId: otherVariableId, chartIds: [chartId] },
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

        const response = await cleanup({ keepVariableIds: [variableId] })

        expect(response.deleted).toEqual([otherVariableId])
        expect(await env.getCount(ChartConfigsTableName)).toBe(0)
    })

    it("dryRun reports what would go without deleting anything", async () => {
        const response = await cleanup({
            keepVariableIds: [variableId],
            dryRun: true,
        })

        expect(response.deleted).toEqual([])
        expect(response.deletable).toEqual([otherVariableId])
        expect(await remainingVariableIds()).toEqual([
            variableId,
            otherVariableId,
        ])
    })
})
