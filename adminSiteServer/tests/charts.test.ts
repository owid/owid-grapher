import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartConfigsTableName,
    ChartsTableName,
    MultiDimDataPagesTableName,
    MultiDimXChartConfigsTableName,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { omitUndefinedValues } from "@ourworldindata/utils"
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
        const chartConfigsCountAfter = await env.getCount(ChartConfigsTableName)
        // one for the full config and one for the patch config
        expect(chartConfigsCountAfter).toBe(2)

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
        const patchConfigETL = JSON.parse(row.config)

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
        expect(patchConfigETL).toEqual(processedTestVariableConfigETL)

        // the effective indicator config is the ETL config
        const mergedGrapherConfig = await env.fetchJson(
            `/variables/mergedGrapherConfig/${variableId}.json`
        )
        expect(mergedGrapherConfig).toEqual(patchConfigETL)

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
            ...mergedGrapherConfig,
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
                multiDimView1.patchConfigId,
                multiDimView2.chartConfigId,
                multiDimView2.patchConfigId,
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
        )?.config
        const mergedGrapherConfig = await env.fetchJson(
            `/variables/mergedGrapherConfig/${variableId}.json`
        )
        expect(parentConfig).toEqual(mergedGrapherConfig)

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
        )?.config
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
        expect(parent.config).toEqual(fullConfigETL)

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
            `/variables/mergedGrapherConfig/${variableId}.json`
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
