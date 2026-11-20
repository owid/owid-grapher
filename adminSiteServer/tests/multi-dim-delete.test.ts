import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartConfigsTableName,
    MultiDimDataPagesTableName,
    MultiDimViewDimensionsTableName,
    MultiDimXChartConfigsTableName,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import {
    catalogPath,
    multiDimConfig,
    otherVariableId,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"

const env = getAdminTestEnv()

const testMultiDimConfig = multiDimConfig([
    {
        dimensions: { metric: "total" },
        indicators: { y: variableId },
    },
    {
        dimensions: { metric: "per_capita" },
        indicators: { y: otherVariableId },
    },
])

async function createMultiDim(): Promise<{
    id: number
    viewConfigIds: string[]
}> {
    const { id } = await env.request({
        method: "PUT",
        path: `/multi-dims/${encodeURIComponent(catalogPath)}`,
        body: JSON.stringify({ config: testMultiDimConfig }),
    })
    const views = await env
        .testKnex(MultiDimXChartConfigsTableName)
        .where({ multiDimId: id })
    return { id, viewConfigIds: views.map((view) => view.chartConfigId) }
}

describe("Deleting a multi-dim", { timeout: 20000 }, () => {
    beforeEach(async () => {
        await seedDatasetAndVariables(env)
    })

    it("removes an unpublished multi-dim with its view configs", async () => {
        const { id, viewConfigIds } = await createMultiDim()
        expect(viewConfigIds).toHaveLength(2)

        await env.request({ method: "DELETE", path: `/multi-dims/${id}` })

        expect(
            await env.testKnex(MultiDimDataPagesTableName).where({ id })
        ).toHaveLength(0)
        expect(
            await env
                .testKnex(MultiDimXChartConfigsTableName)
                .where({ multiDimId: id })
        ).toHaveLength(0)
        expect(
            await env
                .testKnex(ChartConfigsTableName)
                .whereIn("id", viewConfigIds)
        ).toHaveLength(0)
        // Append-only analytics mapping survives the deletion
        expect(
            await env
                .testKnex(MultiDimViewDimensionsTableName)
                .whereIn("chartConfigId", viewConfigIds)
        ).toHaveLength(2)
    })

    it("refuses to delete a published multi-dim", async () => {
        const { id } = await createMultiDim()
        await env
            .testKnex(MultiDimDataPagesTableName)
            .where({ id })
            .update({ slug: "energy-use", published: true })

        await env.request({
            method: "DELETE",
            path: `/multi-dims/${id}`,
            expectStatus: 400,
        })

        expect(
            await env.testKnex(MultiDimDataPagesTableName).where({ id })
        ).toHaveLength(1)
    })

    it("refuses to delete a multi-dim a narrative chart is based on", async () => {
        const { id, viewConfigIds } = await createMultiDim()
        await env.request({
            method: "POST",
            path: "/narrative-charts",
            body: JSON.stringify({
                type: "multiDim",
                name: "narrative-chart-from-mdim-view",
                parentChartConfigId: viewConfigIds[0],
                config: {
                    $schema: latestGrapherConfigSchema,
                    title: "Narrative title",
                },
            }),
        })

        await env.request({
            method: "DELETE",
            path: `/multi-dims/${id}`,
            expectStatus: 400,
        })

        expect(
            await env.testKnex(MultiDimDataPagesTableName).where({ id })
        ).toHaveLength(1)
    })
})
