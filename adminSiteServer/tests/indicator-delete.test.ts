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
    datasetId,
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

    const sortIds = (ids: number[]): number[] => [...ids].sort((a, b) => a - b)

    async function remainingIndicatorIds(): Promise<number[]> {
        const ids = await env
            .testKnex(VariablesTableName)
            .where({ datasetId })
            .pluck<number[]>("id")
        return sortIds(ids)
    }

    const catalogPath = "test/catalog#path"

    /** A two-view multi-dim page, unpublished, its second view showing the indicator we delete. */
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
        // `upsertExplorer` stores a newly created explorer unpublished whatever its TSV says, so
        // publishing one takes a second write.
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

        expect(sortIds(response.deleted)).toEqual([variableId, otherVariableId])
        expect(await remainingIndicatorIds()).toEqual([])
    })

    it("is a no-op when given nothing", async () => {
        const response = await deleteIndicators([])

        expect(response.deleted).toEqual([])
        expect(response.blocked).toEqual([])
        expect(await remainingIndicatorIds()).toEqual([
            variableId,
            otherVariableId,
        ])
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
            { id: 1, title: "Only cited by the deleted indicator" },
            { id: 2, title: "Also cited by the surviving indicator" },
        ])
        await env.testKnex(OriginsVariablesTableName).insert([
            { originId: 1, variableId: otherVariableId, displayOrder: 0 },
            { originId: 2, variableId: otherVariableId, displayOrder: 1 },
            { originId: 2, variableId, displayOrder: 0 },
        ])

        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([otherVariableId])
        expect(
            await env.testKnex(OriginsTableName).orderBy("id").pluck("id")
        ).toEqual([2])
    })

    it("deletes the sources nothing else cites and leaves the shared ones", async () => {
        // Legacy indicators cite a source rather than an origin, and nothing but
        // `variables.sourceId` reaches one
        await env.testKnex(SourcesTableName).insert([
            {
                id: 1,
                name: "Only cited by the deleted indicator",
                description: "{}",
            },
            {
                id: 2,
                name: "Also cited by the surviving indicator",
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
            await env.testKnex(SourcesTableName).orderBy("id").pluck("id")
        ).toEqual([2])
    })

    it("deletes the multi-dim view chart configs that go with a deleted indicator", async () => {
        // Predecessor of this endpoint, which found the leak: owid/etl#6672.
        await seedMultiDim()
        const configCountBefore = await env.getCount(ChartConfigsTableName)
        expect(await env.getCount(MultiDimXChartConfigsTableName)).toBe(2)

        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([otherVariableId])
        expect(await env.getCount(MultiDimXChartConfigsTableName)).toBe(1)
        expect(await env.getCount(ChartConfigsTableName)).toBe(
            configCountBefore - 1
        )
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

    it("deletes an indicator only a draft explorer names", async () => {
        await seedExplorer(false)
        expect(await env.getCount(ExplorerVariablesTableName)).toBe(1)

        const response = await deleteIndicators([otherVariableId])

        expect(response.deleted).toEqual([otherVariableId])
        expect(response.blocked).toEqual([])
        expect(await env.getCount(ExplorerVariablesTableName)).toBe(0)
    })
})
