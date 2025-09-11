import { describe, it, expect, beforeEach } from "vitest"
import { getAdminTestEnv } from "./testEnv.js"
import {
    ChartConfigsTableName,
    ChartsTableName,
    DatasetsTableName,
    VariablesTableName,
    MultiDimDataPagesTableName,
    MultiDimXChartConfigsTableName,
} from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { omitUndefinedValues } from "@ourworldindata/utils"

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

describe("Indicator-level chart configs", { timeout: 15000 }, () => {
    const variableId = 1
    const otherVariableId = 2

    const dummyDataset = {
        id: 1,
        name: "Dummy dataset",
        description: "Dataset description",
        namespace: "owid",
        createdByUserId: 1,
        metadataEditedAt: new Date(),
        metadataEditedByUserId: 1,
        dataEditedAt: new Date(),
        dataEditedByUserId: 1,
    }

    // dummy variable and its grapherConfigETL
    const dummyVariable = {
        id: variableId,
        unit: "kg",
        coverage: "Global by country",
        timespan: "2000-2020",
        datasetId: 1,
        display: '{ "unit": "kg", "shortUnit": "kg" }',
    }
    const testVariableConfigETL = {
        $schema: latestGrapherConfigSchema,
        hasMapTab: true,
        note: "Indicator note",
        selectedEntityNames: ["France", "Italy", "Spain"],
        hideRelativeToggle: false,
    }
    const testVariableConfigAdmin = {
        $schema: latestGrapherConfigSchema,
        title: "Admin title",
        subtitle: "Admin subtitle",
    }

    // second dummy variable and its grapherConfigETL
    const otherDummyVariable = {
        ...dummyVariable,
        id: otherVariableId,
    }
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
        await env.testKnex!(DatasetsTableName).insert([dummyDataset])
        await env.testKnex!(VariablesTableName).insert([
            dummyVariable,
            otherDummyVariable,
        ])
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
        const row = await env.testKnex!(ChartConfigsTableName).first()
        const patchConfigETL = JSON.parse(row.patch)
        const fullConfigETL = JSON.parse(row.full)

        // for ETL configs, patch and full configs should be the same
        expect(patchConfigETL).toEqual(fullConfigETL)

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

        // fetch the admin+etl merged grapher config
        let mergedGrapherConfig = await env.fetchJson(
            `/variables/mergedGrapherConfig/${variableId}.json`
        )

        // since no admin-authored config exists, the merged config should be
        // the same as the ETL config
        expect(mergedGrapherConfig).toEqual(fullConfigETL)

        // add an admin-authored config for the variable
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigAdmin`,
            body: JSON.stringify(testVariableConfigAdmin),
        })

        // fetch the merged grapher config and verify that the admin-authored
        // config has been merged in
        mergedGrapherConfig = await env.fetchJson(
            `/variables/mergedGrapherConfig/${variableId}.json`
        )
        expect(mergedGrapherConfig).toEqual({
            ...processedTestVariableConfigETL,
            ...testVariableConfigAdmin,
        })

        // create mdim config that uses both of the variables
        await env.request({
            method: "PUT",
            path: "/multi-dims/test%2Fcatalog%23path",
            body: JSON.stringify({ config: testMultiDimConfig }),
        })
        const mdim = await env.testKnex!(MultiDimDataPagesTableName).first()
        expect(mdim.catalogPath).toBe("test/catalog#path")
        expect(mdim.slug).toBe(null)
        const savedMdimConfig = JSON.parse(mdim.config)
        // variableId should be normalized to an array
        expect(savedMdimConfig.views[0].indicators.y).toBeInstanceOf(Array)

        const [mdxcc1, mdxcc2] = await env.testKnex!(
            MultiDimXChartConfigsTableName
        )
        expect(mdxcc1.multiDimId).toBe(mdim.id)
        expect(mdxcc1.viewId).toBe("total__all")
        expect(mdxcc1.variableId).toBe(variableId)
        expect(mdxcc2.multiDimId).toBe(mdim.id)
        expect(mdxcc2.viewId).toBe("per_capita__all")
        expect(mdxcc2.variableId).toBe(otherVariableId)

        // view config should override the variable config
        const expectedMergedViewConfig = {
            ...mergedGrapherConfig,
            title: "Total energy use",
            selectedEntityNames: [], // mdims define their own default entities
        }
        const fullViewConfig1 = await env.testKnex!(ChartConfigsTableName)
            .where("id", mdxcc1.chartConfigId)
            .first()
        expect(JSON.parse(fullViewConfig1.full)).toEqual(
            expectedMergedViewConfig
        )

        // update the admin-authored config for the variable
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigAdmin`,
            body: JSON.stringify({
                ...testVariableConfigAdmin,
                subtitle: "Newly updated subtitle",
            }),
        })
        const expectedMergedViewConfigUpdated = {
            ...expectedMergedViewConfig,
            subtitle: "Newly updated subtitle",
        }
        const fullViewConfig1Updated = await env.testKnex!(
            ChartConfigsTableName
        )
            .where("id", mdxcc1.chartConfigId)
            .first()
        expect(JSON.parse(fullViewConfig1Updated.full)).toEqual(
            expectedMergedViewConfigUpdated
        )

        // clean-up the mdim tables
        await env.testKnex!(MultiDimXChartConfigsTableName).delete()
        await env.testKnex!(MultiDimDataPagesTableName).delete()
        await env.testKnex!(ChartConfigsTableName)
            .whereIn("id", [mdxcc1.chartConfigId, mdxcc2.chartConfigId])
            .delete()

        // delete the admin-authored grapher config we just added
        // and verify that the merged config is now the same as the ETL config
        await env.request({
            method: "DELETE",
            path: `/variables/${variableId}/grapherConfigAdmin`,
        })
        mergedGrapherConfig = await env.fetchJson(
            `/variables/mergedGrapherConfig/${variableId}.json`
        )
        expect(mergedGrapherConfig).toEqual(fullConfigETL)

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

        // add grapherConfigAdmin for the variable
        await env.request({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigAdmin`,
            body: JSON.stringify(testVariableConfigAdmin),
        })

        // make a request to create a chart that inherits from the variable
        const response = await env.request({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        // fetch the parent config of the chart and verify that it's the merged etl+admin config
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
            subtitle: "Admin subtitle", // inherited from variable
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

        // delete the admin config
        await env.request({
            method: "DELETE",
            path: `/variables/${variableId}/grapherConfigAdmin`,
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
            const chartRow = await env.testKnex!(ChartsTableName)
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
        const row = await env.testKnex!(ChartConfigsTableName).first()
        const fullConfigETL = JSON.parse(row.full)

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

        // helper functions to get the updatedAt timestamp of the chart and its config
        const chartUpdatedAt = async (): Promise<Date> =>
            (await env.testKnex!(ChartsTableName).first()).updatedAt
        const configUpdatedAt = async (): Promise<Date> =>
            (await env.testKnex!(ChartConfigsTableName).first()).updatedAt

        // verify that both updatedAt timestamps are null initially
        expect(await chartUpdatedAt()).toBeNull()
        expect(await configUpdatedAt()).toBeNull()

        // update the chart
        await env.request({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify({
                ...testChartConfig,
                title: "New title",
            }),
        })

        // verify that the updatedAt timestamps are the same
        const chartAfterUpdate = await chartUpdatedAt()
        const configAfterUpdate = await configUpdatedAt()
        expect(chartAfterUpdate).not.toBeNull()
        expect(configAfterUpdate).not.toBeNull()
        expect(chartAfterUpdate).toEqual(configAfterUpdate)
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
