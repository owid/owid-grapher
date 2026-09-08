import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartConfigsTableName,
    DbPlainMultiDimXChartConfig,
    ExplorerVariablesTableName,
    IndicatorsBeforePreProcessing,
    MultiDimDataPagesTableName,
    MultiDimXChartConfigsTableName,
    OriginsTableName,
    OriginsVariablesTableName,
    SourcesTableName,
    VariablesTableName,
    View,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import {
    catalogPath,
    datasetId,
    multiDimConfig,
    otherVariableId,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"
import { DeleteIndicatorsResult } from "../../db/model/Variable.js"

const env = getAdminTestEnv()

describe("Bulk indicator deletion", { timeout: 15000 }, () => {
    async function deleteIndicators(
        indicatorIds: number[]
    ): Promise<DeleteIndicatorsResult & { success: boolean }> {
        return await env.request({
            method: "POST",
            path: "/variables/delete",
            body: JSON.stringify({ variableIds: indicatorIds }),
        })
    }

    async function remainingIndicatorIds(): Promise<number[]> {
        return await env
            .testKnex(VariablesTableName)
            .where({ datasetId })
            .orderBy("id")
            .pluck<number[]>("id")
    }

    async function seedMultiDim(): Promise<void> {
        const views: View<IndicatorsBeforePreProcessing>[] = [
            {
                config: { title: "Kept view" },
                dimensions: { metric: "total" },
                indicators: { y: variableId },
            },
            {
                config: { title: "View of the deleted indicator" },
                dimensions: { metric: "per_capita" },
                indicators: { y: otherVariableId },
            },
        ]
        await env.request({
            method: "PUT",
            path: `/multi-dims/${encodeURIComponent(catalogPath)}`,
            body: JSON.stringify({ config: multiDimConfig(views) }),
        })
    }

    /** The view row showing the indicator we delete. */
    async function viewForDeletedIndicator(): Promise<DbPlainMultiDimXChartConfig> {
        const view = await env
            .testKnex(MultiDimXChartConfigsTableName)
            .where({ variableId: otherVariableId })
            .first()
        if (!view) throw new Error("The multi-dim page has no view to delete")
        return view
    }

    const explorerSlug = "test-explorer"

    /** An explorer offering the indicator we delete, published or not. */
    async function seedExplorer(isPublished: boolean): Promise<void> {
        const put = async (): Promise<void> =>
            await env.request({
                method: "PUT",
                path: `/explorers/${explorerSlug}`,
                body: JSON.stringify({
                    tsv: [
                        "explorerTitle\tTest explorer",
                        `isPublished\t${isPublished}`,
                        "graphers",
                        "\tyVariableIds\tMetric Radio",
                        `\t${otherVariableId}\tDeleted`,
                    ].join("\n"),
                    commitMessage: "Explorer naming the indicator we delete",
                }),
            })

        await put()
        // `upsertExplorer` stores a newly created explorer unpublished whatever
        // its TSV says, so publishing one takes a second write
        if (isPublished) await put()
    }

    beforeEach(async () => {
        await seedDatasetAndVariables(env)
    })

    it("deletes the indicators it is given and leaves the rest", async () => {
        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([otherVariableId])
        expect(response.blocked).toEqual([])
        expect(await remainingIndicatorIds()).toEqual([variableId])
    })

    it("deletes every indicator it is given", async () => {
        const response = await deleteIndicators([variableId, otherVariableId])

        expect(response.deleted).toEqual([variableId, otherVariableId])
        expect(await remainingIndicatorIds()).toEqual([])
    })

    it("reports an indicator a chart still uses as blocked instead of deleting it", async () => {
        await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "chart-using-the-indicator",
                title: "Chart using the indicator",
                chartTypes: ["LineChart"],
                dimensions: [{ property: "y", variableId: otherVariableId }],
            }),
        })

        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([])
        expect(response.blocked).toEqual([
            {
                variableId: otherVariableId,
                variableName: null,
                usedBy: "chart",
                ref: "chart-using-the-indicator",
            },
        ])
        expect(await remainingIndicatorIds()).toEqual([
            variableId,
            otherVariableId,
        ])
    })

    it("deletes an indicator's leftover chart config", async () => {
        await env.request({
            method: "PUT",
            path: `/variables/${otherVariableId}/grapherConfigETL`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                title: "Indicator-level config",
            }),
        })
        expect(await env.getCount(ChartConfigsTableName)).toBe(1)

        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([otherVariableId])
        expect(await env.getCount(ChartConfigsTableName)).toBe(0)
    })

    it("deletes the origins nothing else cites and leaves the shared ones", async () => {
        await env.testKnex(OriginsTableName).insert([
            { id: 1, title: "Cited only by the deleted indicator" },
            { id: 2, title: "Cited by the surviving indicator too" },
        ])
        await env.testKnex(OriginsVariablesTableName).insert([
            { originId: 1, variableId: otherVariableId, displayOrder: 0 },
            { originId: 2, variableId: otherVariableId, displayOrder: 1 },
            { originId: 2, variableId, displayOrder: 0 },
        ])

        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([otherVariableId])
        expect(
            await env.testKnex(OriginsTableName).orderBy("id").pluck("title")
        ).toEqual(["Cited by the surviving indicator too"])
    })

    it("deletes the sources nothing else cites and leaves the shared ones", async () => {
        await env.testKnex(SourcesTableName).insert([
            {
                id: 1,
                name: "Cited only by the deleted indicator",
                description: "{}",
            },
            {
                id: 2,
                name: "Cited by the surviving indicator too",
                description: "{}",
            },
        ])
        await env
            .testKnex(VariablesTableName)
            .where({ id: otherVariableId })
            .update({ sourceId: 1 })
        await env
            .testKnex(VariablesTableName)
            .where({ id: variableId })
            .update({ sourceId: 2 })

        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([otherVariableId])
        expect(
            await env.testKnex(SourcesTableName).orderBy("id").pluck("name")
        ).toEqual(["Cited by the surviving indicator too"])
    })

    it("deletes the multi-dim view chart configs that go with a deleted indicator", async () => {
        await seedMultiDim()
        expect(await env.getCount(MultiDimXChartConfigsTableName)).toBe(2)
        expect(await env.getCount(ChartConfigsTableName)).toBe(2)

        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([otherVariableId])
        expect(await env.getCount(MultiDimXChartConfigsTableName)).toBe(1)
        expect(await env.getCount(ChartConfigsTableName)).toBe(1)
    })

    it("reports an indicator a published multi-dim page shows as blocked", async () => {
        await seedMultiDim()
        const view = await viewForDeletedIndicator()
        await env
            .testKnex(MultiDimDataPagesTableName)
            .where({ catalogPath })
            .update({ slug: "energy-use", published: true })

        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([])
        expect(response.blocked).toEqual([
            {
                variableId: otherVariableId,
                variableName: null,
                usedBy: "multiDimView",
                ref: `${catalogPath}#${view.viewId}`,
            },
        ])
        expect(await env.getCount(MultiDimXChartConfigsTableName)).toBe(2)
    })

    it("reports an indicator a narrative chart is parented on as blocked", async () => {
        await seedMultiDim()
        const view = await viewForDeletedIndicator()
        await env.request({
            method: "POST",
            path: "/narrative-charts",
            body: JSON.stringify({
                type: "multiDim",
                name: "narrative-chart-on-the-view",
                parentChartConfigId: view.chartConfigId,
                config: {
                    $schema: latestGrapherConfigSchema,
                    title: "Narrative title",
                    chartTypes: ["LineChart"],
                    selectedEntityNames: [],
                },
            }),
        })

        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([])
        expect(response.blocked).toEqual([
            {
                variableId: otherVariableId,
                variableName: null,
                usedBy: "multiDimView",
                ref: `${catalogPath}#${view.viewId}`,
            },
        ])
    })

    it("reports an indicator a published explorer offers as blocked", async () => {
        await seedExplorer(true)
        expect(await env.getCount(ExplorerVariablesTableName)).toBe(1)

        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([])
        expect(response.blocked).toEqual([
            {
                variableId: otherVariableId,
                variableName: null,
                usedBy: "explorer",
                ref: explorerSlug,
            },
        ])
        expect(await env.getCount(ExplorerVariablesTableName)).toBe(1)
    })
})
