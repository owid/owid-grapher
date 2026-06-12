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
        await env.testKnex(DatasetsTableName).insert([dummyDataset])
        await env
            .testKnex(VariablesTableName)
            .insert([dummyVariable, otherDummyVariable])
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
        const mdim = await env.testKnex(MultiDimDataPagesTableName).first()
        expect(mdim.catalogPath).toBe("test/catalog#path")
        expect(mdim.slug).toBe(null)
        const savedMdimConfig = JSON.parse(mdim.config)
        // variableId should be normalized to an array
        expect(savedMdimConfig.views[0].indicators.y).toBeInstanceOf(Array)

        const [mdxcc1, mdxcc2] = await env.testKnex(
            MultiDimXChartConfigsTableName
        )
        expect(mdxcc1.multiDimId).toBe(mdim.id)
        expect(mdxcc1.viewId).toBe("metric=total__source=all")
        expect(mdxcc1.variableId).toBe(variableId)
        expect(mdxcc2.multiDimId).toBe(mdim.id)
        expect(mdxcc2.viewId).toBe("metric=per_capita__source=all")
        expect(mdxcc2.variableId).toBe(otherVariableId)

        // view config should override the variable config
        const expectedMergedViewConfig = {
            ...mergedGrapherConfig,
            title: "Total energy use",
            selectedEntityNames: [], // mdims define their own default entities
        }
        const fullViewConfig1 = await env
            .testKnex(ChartConfigsTableName)
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
        const fullViewConfig1Updated = await env
            .testKnex(ChartConfigsTableName)
            .where("id", mdxcc1.chartConfigId)
            .first()
        expect(JSON.parse(fullViewConfig1Updated.full)).toEqual(
            expectedMergedViewConfigUpdated
        )

        // clean-up the mdim tables
        await env.testKnex(MultiDimXChartConfigsTableName).delete()
        await env.testKnex(MultiDimDataPagesTableName).delete()
        await env
            .testKnex(ChartConfigsTableName)
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
        )?.variableConfig
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
        const fullConfigETL = JSON.parse(row.full)

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

        // helper functions to get the updatedAt timestamp of the chart and its config
        const chartUpdatedAt = async (): Promise<Date> =>
            (await env.testKnex(ChartsTableName).first()).updatedAt
        const configUpdatedAt = async (): Promise<Date> =>
            (await env.testKnex(ChartConfigsTableName).first()).updatedAt

        // verify that both updatedAt timestamps are initialized on create
        expect(await chartUpdatedAt()).not.toBeNull()
        expect(await configUpdatedAt()).not.toBeNull()
        expect(await chartUpdatedAt()).toEqual(await configUpdatedAt())

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

describe("Chart-level ETL configs", { timeout: 15000 }, () => {
    const variableId = 1

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

    const dummyVariable = {
        id: variableId,
        unit: "kg",
        coverage: "Global by country",
        timespan: "2000-2020",
        datasetId: 1,
        display: '{ "unit": "kg", "shortUnit": "kg" }',
    }

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
        await env.testKnex(DatasetsTableName).insert([dummyDataset])
        await env.testKnex(VariablesTableName).insert([dummyVariable])
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
        // charts.configIdETL
        const chartRow = await env
            .testKnex("charts")
            .where("id", chartId)
            .first()
        expect(chartRow.configIdETL).not.toBeNull()
        expect(chartRow.lastEditedAt.getTime()).toBeGreaterThan(
            oldLastEditedAt.getTime()
        )
        expect(chartRow.lastEditedByUserId).toBe(
            createdChartRow.lastEditedByUserId
        )
        const etlRow = await env
            .testKnex(ChartConfigsTableName)
            .where("id", chartRow.configIdETL)
            .first()
        const storedEtlConfig = JSON.parse(etlRow.full)
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

    it("DELETE clears etlConfig and recomputes full", async () => {
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
        expect(chartRow.configIdETL).toBeNull()
        expect(chartRow.lastEditedAt.getTime()).toBeGreaterThan(
            oldLastEditedAt.getTime()
        )
        expect(chartRow.lastEditedByUserId).toBe(
            chartRowBeforeDelete.lastEditedByUserId
        )

        // note falls back to the indicator's value; subtitle is gone
        const fullConfig = await env.fetchJson(`/charts/${chartId}.config.json`)
        expect(fullConfig).toHaveProperty("note", "Note from the indicator")
        expect(fullConfig).not.toHaveProperty("subtitle")
    })

    it("re-points the chart and its inheritance when ETL changes the y-variable", async () => {
        // A dataset re-version gives the same indicator a new id. When ETL
        // re-pushes the chart pointing at the new variable, the chart must
        // plot the new variable *and* inherit the new indicator's fields,
        // not the old one's.
        const variableB = 2
        await env
            .testKnex(VariablesTableName)
            .insert([{ ...dummyVariable, id: variableB }])

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
        const variableB = 2
        const variableC = 3
        await env.testKnex(VariablesTableName).insert([
            { ...dummyVariable, id: variableB },
            { ...dummyVariable, id: variableC },
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
