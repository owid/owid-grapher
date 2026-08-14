import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartConfigsTableName,
    ChartsTableName,
    MultiDimDataPagesTableName,
    MultiDimXChartConfigsTableName,
    GrapherInterface,
    UsersTableName,
    VariablesTableName,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { omitUndefinedValues } from "@ourworldindata/utils"
import { v7 as uuidv7 } from "uuid"
import { saveGrapher } from "../apiRoutes/charts.js"
import { knexReadWriteTransaction, TransactionCloseMode } from "../../db/db.js"
import {
    datasetId,
    otherVariableId,
    seedDatasetAndVariables,
    variableId,
} from "./fixtures.js"

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
        // one for the config the chart renders, one for the config it authored
        const chartConfigsCountAfter = await env.getCount(ChartConfigsTableName)
        expect(chartConfigsCountAfter).toBe(2)

        const parentConfig = (
            await env.fetchJson(`/charts/${chartId}.parent.json`)
        )?.variableConfig
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

    it("deletes a chart and its configs", async () => {
        const { chartId } = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })

        await env.request({ method: "DELETE", path: `/charts/${chartId}` })

        expect(await env.getCount(ChartsTableName)).toBe(0)
        expect(await env.getCount(ChartConfigsTableName)).toBe(0)
    })
})

describe("Indicator-level chart configs", { timeout: 15000 }, () => {
    // grapherConfigETL of the first dummy variable
    const testVariableConfigETL = {
        $schema: latestGrapherConfigSchema,
        hasMapTab: true,
        note: "Indicator note",
        selectedEntityNames: ["France", "Italy", "Spain"],
        hideRelativeToggle: false,
    }

    // grapherConfigETL of the second dummy variable
    const otherTestVariableConfig = {
        $schema: latestGrapherConfigSchema,
        note: "Other indicator note",
    }

    const testChartConfig = {
        $schema: latestGrapherConfigSchema,
        slug: "test-chart",
        title: "Test chart",
        chartTypes: ["Marimekko"],
        selectedEntityNames: [],
        hideRelativeToggle: false,
        dimensions: [
            {
                variableId,
                property: "y",
            },
        ],
    }
    const testMultiDimConfig = {
        grapherConfigSchema: latestGrapherConfigSchema,
        title: {
            title: "Energy use",
            titleVariant: "by energy source",
        },
        views: [
            {
                config: { title: "Total energy use" },
                dimensions: {
                    source: "all",
                    metric: "total",
                },
                indicators: {
                    y: variableId,
                },
            },
            {
                dimensions: {
                    metric: "per_capita",
                    source: "all",
                },
                indicators: {
                    y: otherVariableId,
                },
            },
        ],
        dimensions: [
            {
                name: "Energy source",
                slug: "source",
                choices: [
                    {
                        name: "All sources",
                        slug: "all",
                        group: "Aggregates",
                        description: "Total energy use",
                    },
                ],
            },
            {
                name: "Metric",
                slug: "metric",
                choices: [
                    {
                        name: "Total consumption",
                        slug: "total",
                        description:
                            "The amount of energy consumed nationally per year",
                    },
                    {
                        name: "Consumption per capita",
                        slug: "per_capita",
                        description:
                            "The average amount of energy each person consumes per year",
                    },
                ],
            },
        ],
    }

    beforeEach(async () => {
        await seedDatasetAndVariables(env)
    })

    it("should be able to edit ETL grapher configs via the api", async () => {
        // make sure the database is in a clean state
        const chartConfigsCount = await env.getCount(ChartConfigsTableName)
        expect(chartConfigsCount).toBe(0)

        // add a grapher config for a variable
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testVariableConfigETL),
        })

        // get inserted configs from the database
        const row = await env.testKnex(ChartConfigsTableName).first()
        const configETL = JSON.parse(row.config)

        // check that the dimensions field were added to the config
        const processedTestVariableConfigETL = {
            ...testVariableConfigETL,

            // automatically added
            dimensions: [
                {
                    property: "y",
                    variableId,
                },
            ],
        }
        expect(configETL).toEqual(processedTestVariableConfigETL)

        // the effective indicator config is the ETL config
        const indicatorChartConfig = await env.fetchJson(
            `/variables/${variableId}/chartConfig.json`
        )
        expect(indicatorChartConfig).toEqual(configETL)

        // create multi-dim config that uses both of the variables
        await env.request({
            method: "PUT",
            path: "/multi-dims/test%2Fcatalog%23path",
            body: JSON.stringify({ config: testMultiDimConfig }),
        })
        const multiDim = await env.testKnex(MultiDimDataPagesTableName).first()
        expect(multiDim.catalogPath).toBe("test/catalog#path")
        expect(multiDim.slug).toBe(null)
        const savedMultiDimConfig = JSON.parse(multiDim.config)
        // variableId should be normalized to an array
        expect(savedMultiDimConfig.views[0].indicators.y).toBeInstanceOf(Array)

        const [multiDimView1, multiDimView2] = await env.testKnex(
            MultiDimXChartConfigsTableName
        )
        expect(multiDimView1.multiDimId).toBe(multiDim.id)
        expect(multiDimView1.viewId).toBe("metric=total__source=all")
        expect(multiDimView1.variableId).toBe(variableId)
        expect(multiDimView2.multiDimId).toBe(multiDim.id)
        expect(multiDimView2.viewId).toBe("metric=per_capita__source=all")
        expect(multiDimView2.variableId).toBe(otherVariableId)

        // view config should override the variable config
        const expectedMergedViewConfig = {
            ...indicatorChartConfig,
            title: "Total energy use",
            selectedEntityNames: [], // multi-dims define their own default entities
        }
        const fullViewConfig1 = await env
            .testKnex(ChartConfigsTableName)
            .where("id", multiDimView1.chartConfigId)
            .first()
        expect(JSON.parse(fullViewConfig1.config)).toEqual(
            expectedMergedViewConfig
        )

        // update the ETL config for the variable
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify({
                ...testVariableConfigETL,
                subtitle: "Newly updated subtitle",
            }),
        })
        const expectedMergedViewConfigUpdated = {
            ...expectedMergedViewConfig,
            subtitle: "Newly updated subtitle",
            isPublished: false,
        }
        const fullViewConfig1Updated = await env
            .testKnex(ChartConfigsTableName)
            .where("id", multiDimView1.chartConfigId)
            .first()
        expect(JSON.parse(fullViewConfig1Updated.config)).toEqual(
            expectedMergedViewConfigUpdated
        )

        // clean-up the multi-dim tables
        await env.testKnex(MultiDimXChartConfigsTableName).delete()
        await env.testKnex(MultiDimDataPagesTableName).delete()
        await env
            .testKnex(ChartConfigsTableName)
            .whereIn("id", [
                multiDimView1.chartConfigId,
                multiDimView2.chartConfigId,
            ])
            .delete()

        // delete the ETL-authored grapher config we just added
        await env.request({
            method: "DELETE",
            path: `/variables/${variableId}/grapherConfigETL`,
        })

        // check that the row in the chart_configs table has been deleted
        const chartConfigsCountAfterDelete = await env.getCount(
            ChartConfigsTableName
        )
        expect(chartConfigsCountAfterDelete).toBe(0)
    })

    it("should update all charts that inherit from an indicator", async () => {
        // make sure the database is in a clean state
        const chartConfigsCount = await env.getCount(ChartConfigsTableName)
        expect(chartConfigsCount).toBe(0)

        // add grapherConfigETL for the variable
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testVariableConfigETL),
        })

        // make a request to create a chart that inherits from the variable
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        // fetch the parent config of the chart and verify that it's the ETL config
        const parentConfig = (
            await env.fetchJson(`/charts/${chartId}.parent.json`)
        )?.variableConfig
        const indicatorChartConfig = await env.fetchJson(
            `/variables/${variableId}/chartConfig.json`
        )
        expect(parentConfig).toEqual(indicatorChartConfig)

        // fetch the full config of the chart and verify that it's been merged
        // with the indicator config
        const fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)

        expect(fullConfig).toEqual({
            $schema: latestGrapherConfigSchema,
            id: chartId,
            isPublished: false,
            version: 1,
            slug: "test-chart",
            title: "Test chart",
            chartTypes: ["Marimekko"],
            selectedEntityNames: [],
            hideRelativeToggle: false,
            dimensions: [{ variableId, property: "y" }],
            note: "Indicator note", // inherited from variable
            hasMapTab: true, // inherited from variable
        })

        // fetch the patch config and verify it's diffed correctly
        const patchConfig = await env.fetchJson(
            `/charts/${chartId}.patchConfig.json`
        )
        expect(patchConfig).toEqual({
            $schema: latestGrapherConfigSchema,
            id: chartId,
            version: 1,
            isPublished: false,
            slug: "test-chart",
            title: "Test chart",
            chartTypes: ["Marimekko"],
            selectedEntityNames: [],
            dimensions: [{ variableId, property: "y" }],
            // note that `hideRelativeToggle` is not included
        })

        // delete the ETL config
        await env.request({
            method: "DELETE",
            path: `/variables/${variableId}/grapherConfigETL`,
        })

        // fetch the parent config of the chart and verify there is none
        const parentConfigAfterDelete = (
            await env.fetchJson(`/charts/${chartId}.parent.json`)
        )?.variableConfig
        expect(parentConfigAfterDelete).toBeUndefined()

        // fetch the full config of the chart and verify that it doesn't have
        // values from the deleted ETL config
        const fullConfigAfterDelete = await env.fetchJson(
            `/charts/${chartId}.config.json`
        )
        expect(fullConfigAfterDelete).toEqual({
            $schema: latestGrapherConfigSchema,
            id: chartId,
            version: 1,
            isPublished: false,
            dimensions: [{ property: "y", variableId: 1 }],
            selectedEntityNames: [],
            slug: "test-chart",
            title: "Test chart",
            chartTypes: ["Marimekko"],
        })

        // fetch the patch config and verify it's diffed correctly
        const patchConfigAfterDelete = await env.fetchJson(
            `/charts/${chartId}.patchConfig.json`
        )
        expect(patchConfigAfterDelete).toEqual({
            $schema: latestGrapherConfigSchema,
            id: chartId,
            version: 1,
            isPublished: false,
            slug: "test-chart",
            title: "Test chart",
            chartTypes: ["Marimekko"],
            selectedEntityNames: [],
            dimensions: [
                {
                    variableId,
                    property: "y",
                },
            ],
            // note that hideRelativeToggle is not included
        })
    })

    it("should store the authored config for an indicator", async () => {
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testVariableConfigETL),
        })

        const variable = await env
            .testKnex(VariablesTableName)
            .where({ id: variableId })
            .first()
        const configETL = JSON.parse(
            (
                await env
                    .testKnex(ChartConfigsTableName)
                    .where({ id: variable.patchConfigIdETL })
                    .first()
            ).config
        )
        expect(configETL).toEqual({
            ...testVariableConfigETL,
            // added by makeConfigValidForIndicator
            dimensions: [{ property: "y", variableId }],
        })

        expect(
            await env.fetchJson(`/variables/${variableId}/chartConfig.json`)
        ).toHaveProperty("note", "Indicator note")
    })

    it("should re-merge the resolved config from the patch row when an indicator changes", async () => {
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testVariableConfigETL),
        })

        // create a chart that inherits from the indicator
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        const readConfigs = async (): Promise<{
            resolved: GrapherInterface
            patch: GrapherInterface
        }> => {
            const chart = await env
                .testKnex(ChartsTableName)
                .where({ id: chartId })
                .first()
            const rowsById = new Map(
                (
                    await env
                        .testKnex(ChartConfigsTableName)
                        .whereIn("id", [chart.configId, chart.patchConfigId])
                ).map((row) => [row.id, JSON.parse(row.config)])
            )
            return {
                resolved: rowsById.get(chart.configId),
                patch: rowsById.get(chart.patchConfigId),
            }
        }

        const before = await readConfigs()
        expect(before.resolved.note).toBe("Indicator note")
        expect(before.patch.note).toBeUndefined()

        // change the indicator config
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify({
                ...testVariableConfigETL,
                note: "Updated indicator note",
            }),
        })

        const after = await readConfigs()
        // the resolved row picks up the new indicator value ...
        expect(after.resolved.note).toBe("Updated indicator note")
        expect(after.resolved.title).toBe("Test chart")
        // ... while the authored layer it was merged from is untouched
        expect(after.patch).toEqual(before.patch)
    })

    it("should update chart configs when inheritance is enabled/disabled", async () => {
        const checkInheritance = async ({
            shouldBeEnabled,
        }: {
            shouldBeEnabled?: boolean
        }): Promise<void> => {
            const chartRow = await env
                .testKnex(ChartsTableName)
                .where({ id: chartId })
                .first()

            const fullConfig = await env.fetchJson(
                `/charts/${chartId}.config.json`
            )

            if (shouldBeEnabled) {
                expect(chartRow.isInheritanceEnabled).toBeTruthy()
                expect(fullConfig).toHaveProperty("note", "Indicator note")
                expect(fullConfig).toHaveProperty("hasMapTab", true)
            } else {
                expect(chartRow.isInheritanceEnabled).toBeFalsy()
                expect(fullConfig).not.toHaveProperty("note")
                expect(fullConfig).not.toHaveProperty("hasMapTab")
            }
        }

        // make sure the database is in a clean state
        const chartConfigsCount = await env.getCount(ChartConfigsTableName)
        expect(chartConfigsCount).toBe(0)

        // add grapherConfigETL for the variable
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testVariableConfigETL),
        })

        // create a chart whose parent is the given indicator
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        // get the ETL config from the database
        const row = await env.testKnex(ChartConfigsTableName).first()
        const fullConfigETL = JSON.parse(row.config)

        // check the parent of the chart
        const parent = await env.fetchJson(`/charts/${chartId}.parent.json`)
        expect(parent.variableId).toEqual(variableId)
        expect(parent.variableConfig).toEqual(fullConfigETL)

        // verify that inheritance is enabled by default
        await checkInheritance({ shouldBeEnabled: true })

        // disable inheritance
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}?inheritance=disable`,
            body: JSON.stringify(testChartConfig),
        })
        await checkInheritance({ shouldBeEnabled: false })

        // enable inheritance
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}?inheritance=enable`,
            body: JSON.stringify(testChartConfig),
        })
        await checkInheritance({ shouldBeEnabled: true })

        // update the config without making changes to the inheritance setting
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify(testChartConfig),
        })
        await checkInheritance({ shouldBeEnabled: true })
    })

    it("should recompute configs when the parent of a chart changes", async () => {
        // add grapherConfigETL for the variables
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testVariableConfigETL),
        })
        await env.request({
            method: "PUT",
            path: `/variables/${otherVariableId}/grapherConfigETL`,
            body: JSON.stringify(otherTestVariableConfig),
        })

        // create a chart whose parent is the first indicator
        const response = await env.request({
            method: "POST",
            path: "/charts?inheritance=enable",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        // check that chart inherits from the first indicator
        let fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).toHaveProperty("note", "Indicator note")

        // update chart config so that it now inherits from the second indicator
        const chartConfigWithOtherIndicatorAsParent = {
            ...testChartConfig,
            dimensions: [
                {
                    variableId: otherVariableId,
                    property: "y",
                },
            ],
        }
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify(chartConfigWithOtherIndicatorAsParent),
        })

        // check that chart inherits from the second indicator
        fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).toHaveProperty("note", "Other indicator note")

        // update chart config so that it doesn't inherit from an indicator
        const chartConfigWithoutDimensions = omitUndefinedValues({
            ...testChartConfig,
            dimensions: undefined,
        })
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify(chartConfigWithoutDimensions),
        })

        // check that chart doesn't inherit from any indicator
        fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).not.toHaveProperty("note")
    })

    it("should update timestamps on chart update", async () => {
        // make sure the database is in a clean state
        const chartCount = await env.getCount(ChartsTableName)
        expect(chartCount).toBe(0)
        const chartConfigsCount = await env.getCount(ChartConfigsTableName)
        expect(chartConfigsCount).toBe(0)

        // make a request to create a chart
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        // the chart and both of its config rows share one updatedAt
        const expectTimestampsInSync = async (): Promise<Date> => {
            const chart = await env
                .testKnex(ChartsTableName)
                .where({ id: chartId })
                .first()
            const configs = await env
                .testKnex(ChartConfigsTableName)
                .whereIn("id", [chart.configId, chart.patchConfigId])
            expect(configs.length).toBe(2)
            expect(chart.updatedAt).not.toBeNull()
            for (const config of configs)
                expect(config.updatedAt).toEqual(chart.updatedAt)
            return chart.updatedAt
        }

        const updatedAtOnCreate = await expectTimestampsInSync()

        // update the chart
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify({
                ...testChartConfig,
                title: "New title",
            }),
        })

        const updatedAtOnUpdate = await expectTimestampsInSync()
        expect(updatedAtOnUpdate.getTime()).toBeGreaterThanOrEqual(
            updatedAtOnCreate.getTime()
        )
    })

    it("should bump the config version of a dataset's charts on republish", async () => {
        // give the indicator a config so the chart's authored layer and its
        // served config are not the same thing
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testVariableConfigETL),
        })
        const { chartId } = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const version = async (path: string): Promise<number> =>
            (await env.fetchJson(`/charts/${chartId}.${path}.json`)).version
        expect(await version("config")).toBe(1)

        await env.request({
            method: "POST",
            path: `/datasets/${datasetId}/charts`,
            body: JSON.stringify({ republish: true }),
        })

        // both the served config and the authored layer are bumped
        expect(await version("config")).toBe(2)
        expect(await version("patchConfig")).toBe(2)

        // the chart and its config keep a single updatedAt
        const chart = await env
            .testKnex(ChartsTableName)
            .where({ id: chartId })
            .first()
        const config = await env
            .testKnex(ChartConfigsTableName)
            .where({ id: chart.configId })
            .first()
        expect(config.updatedAt).toEqual(chart.updatedAt)

        // the indicator's own config belongs to no chart and is left alone
        const indicatorConfig = await env.fetchJson(
            `/variables/${variableId}/chartConfig.json`
        )
        expect(indicatorConfig).not.toHaveProperty("version")
    })

    it("should return an error if the schema is missing", async () => {
        const invalidConfig = {
            title: "Title",
            // note that the $schema field is missing
        }
        const response = await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(invalidConfig),
        })
        expect(response.success).toBe(false)
    })

    it("should return an error if the schema is invalid", async () => {
        const invalidConfig = {
            $schema: "invalid", // note that the $schema field is invalid
            title: "Title",
        }
        const response = await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(invalidConfig),
        })
        expect(response.success).toBe(false)
    })
})

describe("Chart-level ETL configs", { timeout: 15000 }, () => {
    const testIndicatorConfig = {
        $schema: latestGrapherConfigSchema,
        note: "Note from the indicator",
        hasMapTab: true,
    }

    const testChartConfig = {
        $schema: latestGrapherConfigSchema,
        slug: "test-chart-etl",
        title: "Title set on chart create",
        chartTypes: ["LineChart"],
        dimensions: [{ variableId, property: "y" }],
    }

    const testChartEtlConfig = {
        $schema: latestGrapherConfigSchema,
        title: "Title from chart's ETL config",
        subtitle: "Subtitle from chart's ETL config",
    }

    beforeEach(async () => {
        await seedDatasetAndVariables(env)
    })

    it("PUT inserts an etlConfig and merges it into full", async () => {
        // create a chart
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId
        const createdChartRow = await env
            .testKnex("charts")
            .where("id", chartId)
            .first()
        const oldLastEditedAt = new Date("2000-01-01T00:00:00.000Z")
        await env
            .testKnex("charts")
            .where("id", chartId)
            .update({ lastEditedAt: oldLastEditedAt })

        // push an etlConfig
        const putResponse = await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify(testChartEtlConfig),
        })
        expect(putResponse.success).toBe(true)

        // the ETL config is stored in its own chart_configs row, reached via
        // charts.patchConfigIdETL
        const chartRow = await env
            .testKnex("charts")
            .where("id", chartId)
            .first()
        expect(chartRow.patchConfigIdETL).not.toBeNull()
        expect(chartRow.lastEditedAt.getTime()).toBeGreaterThan(
            oldLastEditedAt.getTime()
        )
        expect(chartRow.lastEditedByUserId).toBe(
            createdChartRow.lastEditedByUserId
        )
        const etlRow = await env
            .testKnex(ChartConfigsTableName)
            .where("id", chartRow.patchConfigIdETL)
            .first()
        const storedEtlConfig = JSON.parse(etlRow.config)
        expect(storedEtlConfig).toMatchObject({
            title: "Title from chart's ETL config",
            subtitle: "Subtitle from chart's ETL config",
        })

        // full should reflect the etlConfig values that aren't overridden by
        // the admin patch (patch.title was set at create time, so it wins)
        const fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).toMatchObject({
            title: "Title set on chart create", // from patch (admin)
            subtitle: "Subtitle from chart's ETL config", // from etlConfig
        })
    })

    it("respects 3-layer merge precedence: variableETL → etlConfig → patch", async () => {
        // push the indicator's grapher_config (variableETL layer)
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testIndicatorConfig),
        })

        // create a chart that inherits from the indicator
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "layer-test",
                chartTypes: ["LineChart"],
                dimensions: [{ variableId, property: "y" }],
            }),
        })
        const chartId = response.chartId

        // before etlConfig: note comes from indicator
        let fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).toHaveProperty("note", "Note from the indicator")
        expect(fullConfig).toHaveProperty("hasMapTab", true)

        // push an etlConfig that overrides note and adds subtitle
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                note: "Note from etlConfig",
                subtitle: "Subtitle from etlConfig",
            }),
        })

        // etlConfig should override the indicator's note; hasMapTab still
        // comes from the indicator (not in etlConfig)
        fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).toHaveProperty("note", "Note from etlConfig")
        expect(fullConfig).toHaveProperty("subtitle", "Subtitle from etlConfig")
        expect(fullConfig).toHaveProperty("hasMapTab", true)

        // now an admin edits the chart and overrides the note
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify({
                ...fullConfig,
                note: "Note overridden by admin",
            }),
        })

        // admin patch wins over etlConfig
        fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).toHaveProperty("note", "Note overridden by admin")
        expect(fullConfig).toHaveProperty("subtitle", "Subtitle from etlConfig")
    })

    it("preserves admin patch when ETL re-pushes the etlConfig", async () => {
        // create chart + initial etlConfig
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "preserve-test",
                chartTypes: ["LineChart"],
                dimensions: [{ variableId, property: "y" }],
            }),
        })
        const chartId = response.chartId

        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                title: "ETL title v1",
                subtitle: "ETL subtitle",
            }),
        })

        // admin overrides the title in the chart editor
        let fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify({
                ...fullConfig,
                title: "Admin title",
            }),
        })

        fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig.title).toBe("Admin title")
        expect(fullConfig.subtitle).toBe("ETL subtitle")

        // ETL re-pushes a new etlConfig with a different title — admin's
        // patch should still win, etlConfig's other fields should update
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                title: "ETL title v2",
                subtitle: "New ETL subtitle",
            }),
        })

        fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig.title).toBe("Admin title") // patch survives
        expect(fullConfig.subtitle).toBe("New ETL subtitle") // etlConfig updates
    })

    it("DELETE detaches the ETL layer without changing the rendered chart", async () => {
        // setup: indicator + chart + etlConfig
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testIndicatorConfig),
        })

        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "delete-test",
                chartTypes: ["LineChart"],
                dimensions: [{ variableId, property: "y" }],
            }),
        })
        const chartId = response.chartId

        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                note: "etlConfig note",
                subtitle: "etlConfig subtitle",
            }),
        })
        const chartRowBeforeDelete = await env
            .testKnex("charts")
            .where("id", chartId)
            .first()
        const oldLastEditedAt = new Date("2000-01-01T00:00:00.000Z")
        await env
            .testKnex("charts")
            .where("id", chartId)
            .update({ lastEditedAt: oldLastEditedAt })

        // delete the etlConfig
        const delResponse = await env.request({
            method: "DELETE",
            path: `/charts/${chartId}/etlConfig`,
        })
        expect(delResponse.success).toBe(true)

        // the chart's ETL pointer is cleared and its ETL config row is deleted
        const chartRow = await env
            .testKnex("charts")
            .where("id", chartId)
            .first()
        expect(chartRow.patchConfigIdETL).toBeNull()
        // a render-neutral detach is not a content edit: lastEditedAt untouched
        expect(chartRow.lastEditedAt.getTime()).toBe(oldLastEditedAt.getTime())
        expect(chartRow.lastEditedByUserId).toBe(
            chartRowBeforeDelete.lastEditedByUserId
        )

        // detaching is render-neutral: the ETL layer's fields survive as admin
        // overrides, and fields matching the indicator stay inherited
        const fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).toHaveProperty("note", "etlConfig note")
        expect(fullConfig).toHaveProperty("subtitle", "etlConfig subtitle")
        expect(fullConfig).toHaveProperty("hasMapTab", true) // from indicator

        const patchConfig = await env.fetchJson(
            `/charts/${chartId}.patchConfig.json`
        )
        // absorbed from the departed ETL layer
        expect(patchConfig).toHaveProperty("note", "etlConfig note")
        expect(patchConfig).toHaveProperty("subtitle", "etlConfig subtitle")
        // still inherited from the indicator, so not in patch
        expect(patchConfig).not.toHaveProperty("hasMapTab")
    })

    it("DELETE preserves the grapher dimensions the patch no longer carries", async () => {
        // The realistic state of an ETL-managed chart: after the first ETL
        // push, `dimensions` lives only in the ETL layer (it gets stripped
        // from the patch). Detaching must fold it back into the patch, not
        // blank the chart.
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "detach-dims-test",
                chartTypes: ["LineChart"],
                dimensions: [{ variableId, property: "y" }],
            }),
        })
        const chartId = response.chartId

        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                title: "ETL-managed chart",
                dimensions: [{ variableId, property: "y" }],
            }),
        })

        // precondition: the ETL layer owns the dimensions, the patch doesn't
        let patchConfig = await env.fetchJson(
            `/charts/${chartId}.patchConfig.json`
        )
        expect(patchConfig.dimensions).toBeUndefined()

        const delResponse = await env.request({
            method: "DELETE",
            path: `/charts/${chartId}/etlConfig`,
        })
        expect(delResponse.success).toBe(true)

        // the chart still plots its indicator...
        const fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig.dimensions).toEqual([{ variableId, property: "y" }])
        expect(fullConfig.title).toBe("ETL-managed chart")

        // ...because the patch absorbed the dimensions from the ETL layer
        patchConfig = await env.fetchJson(`/charts/${chartId}.patchConfig.json`)
        expect(patchConfig.dimensions).toEqual([{ variableId, property: "y" }])

        // chart_dimensions stays intact
        const dimRows = await env
            .testKnex("chart_dimensions")
            .where("chartId", chartId)
        expect(dimRows.length).toBe(1)
    })

    it("re-points the chart and its inheritance when ETL changes the y-variable", async () => {
        // A dataset re-version gives the same indicator a new id. When ETL
        // re-pushes the chart pointing at the new variable, the chart must
        // plot the new variable *and* inherit the new indicator's fields,
        // not the old one's.
        const variableB = otherVariableId

        // Two indicators, each with a distinct inherited note.
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                note: "Note from indicator A",
            }),
        })
        await env.request({
            method: "PUT",
            path: `/variables/${variableB}/grapherConfigETL`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                note: "Note from indicator B",
            }),
        })

        // Create a chart plotting indicator A.
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "reversion-test",
                chartTypes: ["LineChart"],
                dimensions: [{ variableId, property: "y" }],
            }),
        })
        const chartId = response.chartId

        // ETL's first push carries the same dimensions — this clears the
        // bootstrap dimensions from `patch` (mirrors the real chart-upsert flow).
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                dimensions: [{ variableId, property: "y" }],
            }),
        })
        let fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).toHaveProperty("note", "Note from indicator A")

        // ETL re-points the chart at indicator B (dataset re-versioning).
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                dimensions: [{ variableId: variableB, property: "y" }],
            }),
        })

        // The chart now plots indicator B and inherits B's note, not A's.
        fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig.dimensions?.[0]?.variableId).toBe(variableB)
        expect(fullConfig).toHaveProperty("note", "Note from indicator B")
    })

    it("keeps inheriting from the admin's variable when patch overrides dimensions", async () => {
        // An admin who hand-edits the plotted variable in the chart editor
        // creates a genuine dimensions override in `patch`. A later ETL push
        // pointing elsewhere must not re-point the chart, and the inherited
        // fields must follow the variable the chart actually plots (the
        // admin's), not the ETL layer's.
        const variableB = otherVariableId
        const variableC = 3
        await env.testKnex(VariablesTableName).insert([
            {
                id: variableC,
                unit: "kg",
                coverage: "Global by country",
                timespan: "2000-2020",
                datasetId,
                display: '{ "unit": "kg", "shortUnit": "kg" }',
            },
        ])
        await env.request({
            method: "PUT",
            path: `/variables/${variableC}/grapherConfigETL`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                note: "Note from indicator C",
            }),
        })

        // ETL-authored chart plotting indicator A.
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "admin-dims-override-test",
                chartTypes: ["LineChart"],
                dimensions: [{ variableId, property: "y" }],
            }),
        })
        const chartId = response.chartId
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                dimensions: [{ variableId, property: "y" }],
            }),
        })

        // Admin re-points the chart at indicator C in the chart editor.
        let fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify({
                ...fullConfig,
                dimensions: [{ variableId: variableC, property: "y" }],
            }),
        })

        // ETL re-points at indicator B — the admin's override must win.
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                dimensions: [{ variableId: variableB, property: "y" }],
            }),
        })

        fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig.dimensions?.[0]?.variableId).toBe(variableC)
        expect(fullConfig).toHaveProperty("note", "Note from indicator C")
    })

    it("does not bump version or add a revision on a no-op ETL re-push", async () => {
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        // First ETL config push.
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify(testChartEtlConfig),
        })
        const afterFirst = await env.fetchJson(`/charts/${chartId}.config.json`)
        const versionAfterFirst = afterFirst.version
        const revisionsAfterFirst = (
            await env.testKnex("chart_revisions").where("chartId", chartId)
        ).length

        // Identical re-push (e.g. --force, a data refresh, a bulk ETL run).
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify(testChartEtlConfig),
        })
        const afterRepush = await env.fetchJson(
            `/charts/${chartId}.config.json`
        )
        const revisionsAfterRepush = (
            await env.testKnex("chart_revisions").where("chartId", chartId)
        ).length

        // No change → version untouched, no new revision.
        expect(afterRepush.version).toBe(versionAfterFirst)
        expect(revisionsAfterRepush).toBe(revisionsAfterFirst)

        // A genuine config change still bumps the version.
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                ...testChartEtlConfig,
                subtitle: "A genuinely different subtitle",
            }),
        })
        const afterChange = await env.fetchJson(
            `/charts/${chartId}.config.json`
        )
        expect(afterChange.version).toBeGreaterThan(versionAfterFirst)
    })

    it("persists the rediffed patch on a no-op so ETL can later update a field it adopted", async () => {
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "adopt-test",
                chartTypes: ["LineChart"],
                dimensions: [{ variableId, property: "y" }],
            }),
        })
        const chartId = response.chartId

        // Admin sets a title in the chart editor → lands in the admin patch.
        let fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify({ ...fullConfig, title: "Shared title" }),
        })

        // ETL adopts that exact title. The rendered `full` is unchanged (still
        // "Shared title"), so this is a no-op render-wise, but `title` must be
        // dropped from the admin patch so ETL now owns it.
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                title: "Shared title",
            }),
        })
        const patchAfterAdopt = await env.fetchJson(
            `/charts/${chartId}.patchConfig.json`
        )
        expect(patchAfterAdopt.title).toBeUndefined()

        // ETL now changes the title it owns — it must propagate to `full`
        // (without the patch persistence above, the stale patch entry would
        // mask this and the title would stay "Shared title").
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                title: "ETL-owned title",
            }),
        })
        fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig.title).toBe("ETL-owned title")
    })

    it("backfills catalogPath on a no-op re-push for a chart that already has an etlConfig", async () => {
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "catalogpath-test",
                chartTypes: ["LineChart"],
                dimensions: [{ variableId, property: "y" }],
            }),
        })
        const chartId = response.chartId

        // First push creates the etlConfig row; no catalogPath supplied yet.
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                subtitle: "ETL subtitle",
            }),
        })
        let chartRow = await env.testKnex("charts").where("id", chartId).first()
        expect(chartRow.catalogPath).toBeNull()

        // Identical re-push (no-op for `full`) but now carrying a catalogPath —
        // it must still be backfilled despite the early return.
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig?catalogPath=${encodeURIComponent(
                "grapher/test/latest/x#y"
            )}`,
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                subtitle: "ETL subtitle",
            }),
        })
        chartRow = await env.testKnex("charts").where("id", chartId).first()
        expect(chartRow.catalogPath).toBe("grapher/test/latest/x#y")
    })

    it("rejects an etlConfig with no $schema", async () => {
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        const putResponse = await env.request({
            method: "PUT",
            path: `/charts/${chartId}/etlConfig`,
            body: JSON.stringify({
                // no $schema
                title: "T",
            }),
        })
        expect(putResponse.success).toBe(false)
    })
})

describe("Chart slug validation", { timeout: 15000 }, () => {
    it("should allow creating a draft with an empty slug", async () => {
        const draftConfig = {
            $schema: latestGrapherConfigSchema,
            title: "Draft without slug",
            chartTypes: ["LineChart"],
            // No slug provided - should be allowed for drafts
        }

        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(draftConfig),
        })

        expect(response.success).toBe(true)
        expect(typeof response.chartId).toBe("number")

        const fullConfig = await env.fetchJson(
            `/charts/${response.chartId}.config.json`
        )
        expect(fullConfig.isPublished).toBe(false)
        expect(fullConfig.slug).toBeUndefined()
    })

    it("should allow creating a draft with a unique slug", async () => {
        const draftConfig = {
            $schema: latestGrapherConfigSchema,
            slug: "unique-draft-slug",
            title: "Draft with unique slug",
            chartTypes: ["LineChart"],
        }

        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(draftConfig),
        })

        expect(response.success).toBe(true)
        expect(typeof response.chartId).toBe("number")

        const fullConfig = await env.fetchJson(
            `/charts/${response.chartId}.config.json`
        )
        expect(fullConfig.isPublished).toBe(false)
        expect(fullConfig.slug).toBe("unique-draft-slug")
    })

    it("should reject creating a draft with a duplicate slug", async () => {
        // First create a chart with a slug
        const firstChart = {
            $schema: latestGrapherConfigSchema,
            slug: "duplicate-test-slug",
            title: "First chart",
            chartTypes: ["LineChart"],
        }

        const firstResponse = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(firstChart),
        })
        expect(firstResponse.success).toBe(true)

        // Try to create another chart with the same slug
        const secondChart = {
            $schema: latestGrapherConfigSchema,
            slug: "duplicate-test-slug",
            title: "Second chart",
            chartTypes: ["LineChart"],
        }

        const secondResponse = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(secondChart),
        })

        expect(secondResponse.success).toBe(false)
        expect(secondResponse.error.message).toContain(
            "This chart slug is in use by another chart"
        )
    })

    it("should allow multiple drafts with empty slugs", async () => {
        const draft1 = {
            $schema: latestGrapherConfigSchema,
            title: "Draft 1 without slug",
            chartTypes: ["LineChart"],
        }

        const draft2 = {
            $schema: latestGrapherConfigSchema,
            title: "Draft 2 without slug",
            chartTypes: ["LineChart"],
        }

        const response1 = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(draft1),
        })

        const response2 = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(draft2),
        })

        expect(response1.success).toBe(true)
        expect(response2.success).toBe(true)

        // Both should have undefined slugs
        const config1 = await env.fetchJson(
            `/charts/${response1.chartId}.config.json`
        )
        const config2 = await env.fetchJson(
            `/charts/${response2.chartId}.config.json`
        )

        expect(config1.slug).toBeUndefined()
        expect(config2.slug).toBeUndefined()
    })

    it("should reject publishing a chart with an empty slug", async () => {
        // Create a draft without a slug
        const draftConfig = {
            $schema: latestGrapherConfigSchema,
            title: "Draft to publish",
            chartTypes: ["LineChart"],
        }

        const createResponse = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(draftConfig),
        })
        expect(createResponse.success).toBe(true)

        // Try to publish it without adding a slug
        const publishConfig = {
            $schema: latestGrapherConfigSchema,
            title: "Draft to publish",
            chartTypes: ["LineChart"],
            isPublished: true,
        }

        const publishResponse = await env.request({
            method: "PUT",
            path: `/charts/${createResponse.chartId}`,
            body: JSON.stringify(publishConfig),
        })

        expect(publishResponse.success).toBe(false)
        expect(publishResponse.error.message).toContain("Invalid chart slug")
    })

    it("should reject updating a draft to use a duplicate slug", async () => {
        // Create first chart
        const chart1 = {
            $schema: latestGrapherConfigSchema,
            slug: "existing-slug",
            title: "Chart 1",
            chartTypes: ["LineChart"],
        }

        const response1 = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(chart1),
        })
        expect(response1.success).toBe(true)

        // Create second chart with different slug
        const chart2 = {
            $schema: latestGrapherConfigSchema,
            slug: "different-slug",
            title: "Chart 2",
            chartTypes: ["LineChart"],
        }

        const response2 = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(chart2),
        })
        expect(response2.success).toBe(true)

        // Try to update second chart to use first chart's slug
        const updateConfig = {
            $schema: latestGrapherConfigSchema,
            slug: "existing-slug",
            title: "Chart 2 updated",
            chartTypes: ["LineChart"],
        }

        const updateResponse = await env.request({
            method: "PUT",
            path: `/charts/${response2.chartId}`,
            body: JSON.stringify(updateConfig),
        })

        expect(updateResponse.success).toBe(false)
        expect(updateResponse.error.message).toContain(
            "This chart slug is in use by another chart"
        )
    })

    it("should allow updating a draft when a stale redirect exists for its slug", async () => {
        // Simulate the bug scenario from GitHub issue #6040:
        // 1. Chart 1 originally has slug "original-slug" (published)
        // 2. Chart 1 is renamed to "new-slug" (creates redirect: original-slug → chart 1)
        // 3. Chart 2 (draft) is created with "original-slug"
        // 4. Updating chart 2 should succeed (redirect check skipped for drafts)

        // Create and publish chart 1
        const chart1 = {
            $schema: latestGrapherConfigSchema,
            slug: "redirect-bug-original",
            title: "Chart 1",
            chartTypes: ["LineChart"],
            isPublished: true,
        }
        const response1 = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(chart1),
        })
        expect(response1.success).toBe(true)
        const chartId1 = response1.chartId

        // Rename chart 1 to create a redirect
        const chart1Renamed = {
            ...chart1,
            slug: "redirect-bug-renamed",
        }
        await env.request({
            method: "PUT",
            path: `/charts/${chartId1}`,
            body: JSON.stringify(chart1Renamed),
        })

        // Verify redirect was created
        const redirects = await env.testKnex("chart_slug_redirects").where({
            chart_id: chartId1,
            slug: "redirect-bug-original",
        })
        expect(redirects.length).toBe(1)

        // Create draft chart 2 with the original slug
        const chart2 = {
            $schema: latestGrapherConfigSchema,
            slug: "redirect-bug-original",
            title: "Chart 2",
            chartTypes: ["LineChart"],
            // Note: not published (draft)
        }
        const response2 = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(chart2),
        })
        expect(response2.success).toBe(true)
        const chartId2 = response2.chartId

        // Update chart 2 - this should succeed
        const chart2Updated = {
            ...chart2,
            title: "Chart 2 Updated",
        }
        const updateResponse = await env.request({
            method: "PUT",
            path: `/charts/${chartId2}`,
            body: JSON.stringify(chart2Updated),
        })

        expect(updateResponse.success).toBe(true)

        // Verify the update worked
        const fullConfig = await env.fetchJson(
            `/charts/${chartId2}.config.json`
        )
        expect(fullConfig.title).toBe("Chart 2 Updated")
    })
})

describe("Chart addressing by config UUID", { timeout: 15000 }, () => {
    const testChartConfig: GrapherInterface = {
        $schema: latestGrapherConfigSchema,
        slug: "uuid-test-chart",
        title: "UUID test chart",
        chartTypes: ["LineChart"],
    }

    async function createTestChart(): Promise<{
        chartId: number
        configId: string
    }> {
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId as number
        const row = await env
            .testKnex(ChartsTableName)
            .select("configId")
            .where({ id: chartId })
            .first()
        return { chartId, configId: row.configId as string }
    }

    function rawFetch(path: string): Promise<Response> {
        return fetch(env.baseUrl + path, {
            headers: { Authorization: `Bearer ${env.apiKey}` },
        })
    }

    it("serves chart endpoints addressed by config UUID", async () => {
        const { chartId, configId } = await createTestChart()

        const configById = await env.fetchJson(`/charts/${chartId}.config.json`)
        const configByConfigId = await env.fetchJson(
            `/charts/${configId}.config.json`
        )
        expect(configByConfigId).toEqual(configById)

        const patchByConfigId = await env.fetchJson(
            `/charts/${configId}.patchConfig.json`
        )
        expect(patchByConfigId).toEqual(configById)

        const referencesByConfigId = await env.fetchJson(
            `/charts/${configId}.references.json`
        )
        expect(referencesByConfigId.references).toBeDefined()
    })

    it("updates a chart addressed by config UUID", async () => {
        const { chartId, configId } = await createTestChart()

        const response = await env.request({
            method: "PUT",
            path: `/charts/${configId}`,
            body: JSON.stringify({
                ...testChartConfig,
                title: "Updated title",
            }),
        })
        expect(response.success).toBe(true)
        expect(response.chartId).toBe(chartId)

        const fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig.title).toBe("Updated title")
    })

    it("rejects unknown config UUIDs and malformed chart ids", async () => {
        await createTestChart()

        const unknownUuid = await rawFetch(
            `/charts/0198c0e8-0000-7000-8000-000000000000.config.json`
        )
        expect(unknownUuid.status).toBe(404)

        const malformed = await rawFetch(`/charts/not-a-chart-id.config.json`)
        expect(malformed.status).toBe(400)
    })

    it("creates a chart with a caller-supplied config UUID", async () => {
        const user = await env.testKnex(UsersTableName).first()
        const chartConfigId = uuidv7()

        await knexReadWriteTransaction(
            async (trx) => {
                await saveGrapher(trx, {
                    user,
                    newConfig: testChartConfig,
                    chartConfigId,
                })
            },
            TransactionCloseMode.KeepOpen,
            env.testKnex
        )

        const chartRow = await env
            .testKnex(ChartsTableName)
            .select("id", "configId")
            .first()
        expect(chartRow.configId).toBe(chartConfigId)

        const fullConfig = await env.fetchJson(
            `/charts/${chartConfigId}.config.json`
        )
        expect(fullConfig.id).toBe(chartRow.id)

        // reusing an existing config UUID must fail
        await expect(
            knexReadWriteTransaction(
                async (trx) => {
                    await saveGrapher(trx, {
                        user,
                        newConfig: { ...testChartConfig, slug: "other-slug" },
                        chartConfigId,
                    })
                },
                TransactionCloseMode.KeepOpen,
                env.testKnex
            )
        ).rejects.toThrow(/already exists/)
    })
})

describe("ETL config upsert by config UUID", { timeout: 15000 }, () => {
    const testChartConfig = {
        $schema: latestGrapherConfigSchema,
        slug: "test-chart-etl-upsert",
        title: "Title set on chart create",
        chartTypes: ["LineChart"],
        dimensions: [{ variableId, property: "y" }],
    }

    const testEtlConfig = {
        $schema: latestGrapherConfigSchema,
        slug: "etl-authored-chart",
        title: "Title from the ETL config",
        chartTypes: ["LineChart"],
        dimensions: [{ variableId, property: "y" }],
    }

    beforeEach(async () => {
        await seedDatasetAndVariables(env)
    })

    function rawRequest(arg: {
        method: "PUT" | "DELETE"
        path: string
        body?: string
    }): Promise<Response> {
        return fetch(env.baseUrl + arg.path, {
            method: arg.method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.apiKey}`,
            },
            body: arg.body,
        })
    }

    it("creates a chart when the config UUID doesn't exist yet", async () => {
        const chartConfigId = uuidv7()

        const response = await env.request({
            method: "PUT",
            path: `/charts/by-config/${chartConfigId}/etlConfig?catalogPath=grapher/dummy/latest/dummy%23chart`,
            body: JSON.stringify(testEtlConfig),
        })
        expect(response.success).toBe(true)
        expect(response.created).toBe(true)
        const chartId = response.chartId
        expect(typeof chartId).toBe("number")

        // the new chart carries the caller-supplied UUID as its identity
        const chartRow = await env
            .testKnex(ChartsTableName)
            .where("id", chartId)
            .first()
        expect(chartRow.configId).toBe(chartConfigId)
        expect(chartRow.patchConfigIdETL).not.toBeNull()
        expect(chartRow.catalogPath).toBe("grapher/dummy/latest/dummy#chart")

        // the admin patch starts out almost empty — the ETL layer owns all
        // fields except the non-inheritable slug, which is copied into the
        // patch at creation
        const patchConfig = await env.fetchJson(
            `/charts/${chartId}.patchConfig.json`
        )
        expect(omitUndefinedValues(patchConfig)).toEqual({
            $schema: latestGrapherConfigSchema,
            id: chartId,
            version: patchConfig.version,
            isPublished: false,
            slug: "etl-authored-chart",
        })

        // the rendered full config comes from the ETL layer; the chart is a draft
        const fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).toMatchObject({
            slug: "etl-authored-chart",
            title: "Title from the ETL config",
            isPublished: false,
        })
        expect(fullConfig.dimensions).toEqual([{ variableId, property: "y" }])

        // the chart is also addressable by its config UUID now
        const byConfigId = await env.fetchJson(
            `/charts/${chartConfigId}.config.json`
        )
        expect(byConfigId).toEqual(fullConfig)
    })

    it("updates the ETL layer when called again with the same UUID", async () => {
        const chartConfigId = uuidv7()

        const first = await env.request({
            method: "PUT",
            path: `/charts/by-config/${chartConfigId}/etlConfig`,
            body: JSON.stringify(testEtlConfig),
        })
        expect(first.created).toBe(true)

        const second = await env.request({
            method: "PUT",
            path: `/charts/by-config/${chartConfigId}/etlConfig`,
            body: JSON.stringify({
                ...testEtlConfig,
                subtitle: "Subtitle from the second push",
            }),
        })
        expect(second.success).toBe(true)
        expect(second.created).toBe(false)
        expect(second.chartId).toBe(first.chartId)

        // still only one chart
        expect(await env.getCount(ChartsTableName)).toBe(1)

        const fullConfig = await env.fetchJson(
            `/charts/${first.chartId}.config.json`
        )
        expect(fullConfig.subtitle).toBe("Subtitle from the second push")
    })

    it("attaches an ETL layer to an existing admin-created chart", async () => {
        // create a chart via the regular admin API
        const createResponse = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = createResponse.chartId
        const chartRowBefore = await env
            .testKnex(ChartsTableName)
            .where("id", chartId)
            .first()
        expect(chartRowBefore.patchConfigIdETL).toBeNull()

        // push an ETL config addressed by the chart's config UUID
        const response = await env.request({
            method: "PUT",
            path: `/charts/by-config/${chartRowBefore.configId}/etlConfig`,
            body: JSON.stringify({
                ...testEtlConfig,
                slug: undefined,
                subtitle: "Subtitle from the ETL config",
            }),
        })
        expect(response.success).toBe(true)
        expect(response.created).toBe(false)
        expect(response.chartId).toBe(chartId)

        const chartRowAfter = await env
            .testKnex(ChartsTableName)
            .where("id", chartId)
            .first()
        expect(chartRowAfter.patchConfigIdETL).not.toBeNull()

        // the admin's title (in the patch) still wins over the ETL config
        const fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig.title).toBe("Title set on chart create")
        expect(fullConfig.subtitle).toBe("Subtitle from the ETL config")
    })

    it("rejects malformed config UUIDs", async () => {
        const response = await rawRequest({
            method: "PUT",
            path: `/charts/by-config/not-a-uuid/etlConfig`,
            body: JSON.stringify(testEtlConfig),
        })
        expect(response.status).toBe(400)
    })

    it("rejects a push whose catalogPath doesn't match the chart's existing one", async () => {
        const chartConfigId = uuidv7()
        const first = await env.request({
            method: "PUT",
            path: `/charts/by-config/${chartConfigId}/etlConfig?catalogPath=grapher/first/latest/first%23chart`,
            body: JSON.stringify(testEtlConfig),
        })
        expect(first.success).toBe(true)

        const response = await rawRequest({
            method: "PUT",
            path: `/charts/by-config/${chartConfigId}/etlConfig?catalogPath=grapher/second/latest/second%23chart`,
            body: JSON.stringify({
                ...testEtlConfig,
                subtitle: "Should not be written",
            }),
        })
        expect(response.status).toBe(409)

        const fullConfig = await env.fetchJson(
            `/charts/${first.chartId}.config.json`
        )
        expect(fullConfig.subtitle).toBeUndefined()
    })

    it("rejects assigning a catalogPath that already belongs to a different chart", async () => {
        const sharedCatalogPath = "grapher/shared/latest/shared%23chart"

        const first = await env.request({
            method: "PUT",
            path: `/charts/by-config/${uuidv7()}/etlConfig?catalogPath=${sharedCatalogPath}`,
            body: JSON.stringify(testEtlConfig),
        })
        expect(first.success).toBe(true)

        const response = await rawRequest({
            method: "PUT",
            path: `/charts/by-config/${uuidv7()}/etlConfig?catalogPath=${sharedCatalogPath}`,
            body: JSON.stringify({
                ...testEtlConfig,
                slug: "another-etl-chart",
            }),
        })
        expect(response.status).toBe(409)
    })

    it("leaves no orphan chart behind when a mistakenly re-generated config UUID collides on catalogPath", async () => {
        // Simulates the ETL forgetting the config UUID it already minted for a
        // chart (e.g. a caching bug) and generating a fresh one on a re-run
        // that should have updated the same chart. The push still carries the
        // correct (matching) catalogPath, which is what the guard catches.
        const sharedCatalogPath = "grapher/reused/latest/reused%23chart"

        const first = await env.request({
            method: "PUT",
            path: `/charts/by-config/${uuidv7()}/etlConfig?catalogPath=${sharedCatalogPath}`,
            body: JSON.stringify(testEtlConfig),
        })
        expect(first.success).toBe(true)
        const chartCountAfterFirst = await env.getCount(ChartsTableName)

        const response = await rawRequest({
            method: "PUT",
            path: `/charts/by-config/${uuidv7()}/etlConfig?catalogPath=${sharedCatalogPath}`,
            body: JSON.stringify({
                ...testEtlConfig,
                slug: "another-etl-chart",
            }),
        })
        expect(response.status).toBe(409)

        // The draft chart created for the fresh (wrong) UUID before the guard
        // fired must not survive — the whole request is one transaction.
        const chartCountAfterRejection = await env.getCount(ChartsTableName)
        expect(chartCountAfterRejection).toBe(chartCountAfterFirst)
    })

    it("creates a chart with a caller-supplied config UUID via POST /charts", async () => {
        const chartConfigId = uuidv7()
        const response = await env.request({
            method: "POST",
            path: `/charts?configId=${chartConfigId}`,
            body: JSON.stringify(testChartConfig),
        })
        expect(response.success).toBe(true)

        const chartRow = await env
            .testKnex(ChartsTableName)
            .where("id", response.chartId)
            .first()
        expect(chartRow.configId).toBe(chartConfigId)
    })
})
