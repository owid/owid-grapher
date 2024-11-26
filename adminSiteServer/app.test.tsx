import { google } from "googleapis"
import { jest } from "@jest/globals"
// Mock the google docs api to retrieve files from the test-files directory
// AFAICT, we have to do this directly after the import
// and before any other code that might import googleapis
jest.mock("googleapis", () => {
    const originalModule: any = jest.requireActual("googleapis")

    return {
        ...originalModule,
        google: {
            ...originalModule.google,
            docs: jest.fn(() => ({
                documents: {
                    get: jest.fn(({ documentId }) => {
                        // This is a bit hacky and assumes we are running from inside
                        // the itsJustJavascript directory - I couldn't find a better way
                        // to get the workspace root directory here
                        const unparsed = fs.readFileSync(
                            path.join(
                                __dirname,
                                "..",
                                "..",
                                "adminSiteServer",
                                "test-files",
                                `${documentId}.json`
                            ),
                            "utf8"
                        )
                        const data = JSON.parse(unparsed)
                        return Promise.resolve(data)
                    }),
                },
            })),
        },
    }
})

import { OwidAdminApp } from "./appClass.js"

import { logInAsUser } from "./authentication.js"
import knex, { Knex } from "knex"
import { dbTestConfig } from "../db/tests/dbTestConfig.js"
import {
    TransactionCloseMode,
    knexReadWriteTransaction,
    setKnexInstance,
} from "../db/db.js"
import { cleanTestDb, TABLES_IN_USE } from "../db/tests/testHelpers.js"
import {
    ChartConfigsTableName,
    ChartsTableName,
    DatasetsTableName,
    MultiDimDataPagesTableName,
    MultiDimXChartConfigsTableName,
    VariablesTableName,
} from "@ourworldindata/types"
import path from "path"
import fs from "fs"
import { omitUndefinedValues } from "@ourworldindata/utils"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"

const ADMIN_SERVER_HOST = "localhost"
const ADMIN_SERVER_PORT = 8765

const ADMIN_URL = `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}/admin/api`

jest.setTimeout(10000) // wait for up to 10s for the app server to start
let testKnexInstance: Knex<any, unknown[]> | undefined = undefined
let serverKnexInstance: Knex<any, unknown[]> | undefined = undefined
let app: OwidAdminApp | undefined = undefined
let cookieId: string = ""

beforeAll(async () => {
    // dummy use of google docs so that when we import the google
    // docs above to mock it, prettier will not complain about an unused import
    const _ = google.docs
    testKnexInstance = knex(dbTestConfig)
    serverKnexInstance = knex(dbTestConfig)
    const dataSpec = {
        users: [
            {
                email: "admin@example.com",
                fullName: "Admin",
                password: "admin",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ],
    }

    await cleanTestDb(testKnexInstance)
    for (const [tableName, tableData] of Object.entries(dataSpec)) {
        await testKnexInstance(tableName).insert(tableData)
    }

    setKnexInstance(serverKnexInstance!)

    app = new OwidAdminApp({
        isDev: true,
        isTest: true,
        gitCmsDir: "",
        quiet: true,
    })
    await app.startListening(ADMIN_SERVER_PORT, ADMIN_SERVER_HOST)
    cookieId = (
        await logInAsUser({
            email: "admin@example.com",
            id: 1,
        })
    ).id
})

async function cleanupDb() {
    // We leave the user in the database for other tests to use
    // For other cases it is good to drop any rows created in the test
    const tables = TABLES_IN_USE.filter((table) => table !== "users")
    await knexReadWriteTransaction(
        async (trx) => {
            for (const table of tables) {
                await trx.raw(`DELETE FROM ??`, [table])
            }
        },
        TransactionCloseMode.KeepOpen,
        testKnexInstance
    )
}

afterEach(async () => {
    await cleanupDb()
})

afterAll((done: any) => {
    void cleanupDb()
        .then(() =>
            Promise.allSettled([
                app?.stopListening(),
                testKnexInstance?.destroy(),
                serverKnexInstance?.destroy(),
            ])
        )
        .then(() => done())
})

async function getCountForTable(tableName: string): Promise<number> {
    // This helper simply checks how many rows are in a table. I can be used
    // for super simple asserts to verify if a row was created or deleted.
    const count = await testKnexInstance!.table(tableName).count()
    return count[0]["count(*)"] as number
}

async function fetchJsonFromAdminApi(path: string) {
    const url = ADMIN_URL + path
    const response = await fetch(url, {
        headers: { cookie: `sessionid=${cookieId}` },
    })
    expect(response.status).toBe(200)
    return await response.json()
}

async function makeRequestAgainstAdminApi(
    {
        method,
        path,
        body,
    }: {
        method: "POST" | "PUT" | "DELETE"
        path: string
        body?: string
    },
    { verifySuccess = true }: { verifySuccess?: boolean } = {}
) {
    const url = ADMIN_URL + path
    const response = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json",
            cookie: `sessionid=${cookieId}`,
        },
        body,
    })

    expect(response.status).toBe(200)

    const json = await response.json()

    if (verifySuccess) {
        expect(json.success).toBe(true)
    }

    return json
}

describe("OwidAdminApp", () => {
    const testChartConfig = {
        $schema: latestGrapherConfigSchema,
        slug: "test-chart",
        title: "Test chart",
        chartTypes: ["LineChart"],
    }

    it("should be able to create an app", () => {
        expect(app).toBeTruthy()
        expect(app!.server).toBeTruthy()
    })

    it("should be able to fetch the version from the server", async () => {
        const nodeVersion = await fetch(
            "http://localhost:8765/admin/nodeVersion",
            {
                headers: { cookie: `sessionid=${cookieId}` },
            }
        )
        expect(nodeVersion.status).toBe(200)
        const text = await nodeVersion.text()
        expect(text).toBe("v18.16.0")
    })

    it("should be able to edit a chart via the api", async () => {
        // make sure the database is in a clean state
        const chartCount = await getCountForTable(ChartsTableName)
        expect(chartCount).toBe(0)
        const chartConfigsCount = await getCountForTable(ChartConfigsTableName)
        expect(chartConfigsCount).toBe(0)

        const chartId = 1 // since the chart is the first to be inserted

        // make a request to create a chart
        const response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        expect(response.chartId).toBe(chartId)

        // check that a row in the charts table has been added
        const chartCountAfter = await getCountForTable(ChartsTableName)
        expect(chartCountAfter).toBe(1)

        // check that a row in the chart_configs table has been added
        const chartConfigsCountAfter = await getCountForTable(
            ChartConfigsTableName
        )
        expect(chartConfigsCountAfter).toBe(1)

        // fetch the parent config and verify there is none
        const parentConfig = (
            await fetchJsonFromAdminApi(`/charts/${chartId}.parent.json`)
        )?.config
        expect(parentConfig).toBeUndefined()

        // fetch the full config and verify that id, version and isPublished are added
        const fullConfig = await fetchJsonFromAdminApi(
            `/charts/${chartId}.config.json`
        )
        expect(fullConfig).toEqual({
            ...testChartConfig,
            id: chartId, // must match the db id
            version: 1, // automatically added
            isPublished: false, // automatically added
        })

        // fetch the patch config and verify it's identical to the full config
        const patchConfig = await fetchJsonFromAdminApi(
            `/charts/${chartId}.patchConfig.json`
        )
        expect(patchConfig).toEqual(fullConfig)
    })

    it("should be able to create a GDoc article", async () => {
        const gdocId = "gdoc-test-create-1"
        const response = await makeRequestAgainstAdminApi(
            {
                method: "PUT",
                path: `/gdocs/${gdocId}`,
            },
            { verifySuccess: false }
        )
        expect(response.id).toBe(gdocId)

        // Fetch the GDoc to verify it was created
        const gdoc = await fetchJsonFromAdminApi(`/gdocs/${gdocId}`)
        expect(gdoc.id).toBe(gdocId)
        expect(gdoc.content.title).toBe("Basic article")
    })
})

describe("OwidAdminApp: indicator-level chart configs", () => {
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
        await testKnexInstance!(DatasetsTableName).insert([dummyDataset])
        await testKnexInstance!(VariablesTableName).insert([
            dummyVariable,
            otherDummyVariable,
        ])
    })

    it("should be able to edit ETL grapher configs via the api", async () => {
        // make sure the database is in a clean state
        const chartConfigsCount = await getCountForTable(ChartConfigsTableName)
        expect(chartConfigsCount).toBe(0)

        // add a grapher config for a variable
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testVariableConfigETL),
        })

        // get inserted configs from the database
        const row = await testKnexInstance!(ChartConfigsTableName).first()
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
        let mergedGrapherConfig = await fetchJsonFromAdminApi(
            `/variables/mergedGrapherConfig/${variableId}.json`
        )

        // since no admin-authored config exists, the merged config should be
        // the same as the ETL config
        expect(mergedGrapherConfig).toEqual(fullConfigETL)

        // add an admin-authored config for the variable
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigAdmin`,
            body: JSON.stringify(testVariableConfigAdmin),
        })

        // fetch the merged grapher config and verify that the admin-authored
        // config has been merged in
        mergedGrapherConfig = await fetchJsonFromAdminApi(
            `/variables/mergedGrapherConfig/${variableId}.json`
        )
        expect(mergedGrapherConfig).toEqual({
            ...processedTestVariableConfigETL,
            ...testVariableConfigAdmin,
        })

        // create mdim config that uses both of the variables
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: "/multi-dim/energy",
            body: JSON.stringify(testMultiDimConfig),
        })
        const mdim = await testKnexInstance!(MultiDimDataPagesTableName).first()
        expect(mdim.slug).toBe("energy")
        const savedMdimConfig = JSON.parse(mdim.config)
        // variableId should be normalized to an array
        expect(savedMdimConfig.views[0].indicators.y).toBeInstanceOf(Array)

        const [mdxcc1, mdxcc2] = await testKnexInstance!(
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
            slug: "energy",
        }
        const fullViewConfig1 = await testKnexInstance!(ChartConfigsTableName)
            .where("id", mdxcc1.chartConfigId)
            .first()
        expect(JSON.parse(fullViewConfig1.full)).toEqual(
            expectedMergedViewConfig
        )

        // update the admin-authored config for the variable
        await makeRequestAgainstAdminApi({
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
        const fullViewConfig1Updated = await testKnexInstance!(
            ChartConfigsTableName
        )
            .where("id", mdxcc1.chartConfigId)
            .first()
        expect(JSON.parse(fullViewConfig1Updated.full)).toEqual(
            expectedMergedViewConfigUpdated
        )

        // clean-up the mdim tables
        await testKnexInstance!(MultiDimXChartConfigsTableName).truncate()
        await testKnexInstance!(MultiDimDataPagesTableName).delete()
        await testKnexInstance!(ChartConfigsTableName)
            .whereIn("id", [mdxcc1.chartConfigId, mdxcc2.chartConfigId])
            .delete()

        // delete the admin-authored grapher config we just added
        // and verify that the merged config is now the same as the ETL config
        await makeRequestAgainstAdminApi({
            method: "DELETE",
            path: `/variables/${variableId}/grapherConfigAdmin`,
        })
        mergedGrapherConfig = await fetchJsonFromAdminApi(
            `/variables/mergedGrapherConfig/${variableId}.json`
        )
        expect(mergedGrapherConfig).toEqual(fullConfigETL)

        // delete the ETL-authored grapher config we just added
        await makeRequestAgainstAdminApi({
            method: "DELETE",
            path: `/variables/${variableId}/grapherConfigETL`,
        })

        // check that the row in the chart_configs table has been deleted
        const chartConfigsCountAfterDelete = await getCountForTable(
            ChartConfigsTableName
        )
        expect(chartConfigsCountAfterDelete).toBe(0)
    })

    it("should update all charts that inherit from an indicator", async () => {
        // make sure the database is in a clean state
        const chartConfigsCount = await getCountForTable(ChartConfigsTableName)
        expect(chartConfigsCount).toBe(0)

        // add grapherConfigETL for the variable
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testVariableConfigETL),
        })

        // add grapherConfigAdmin for the variable
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigAdmin`,
            body: JSON.stringify(testVariableConfigAdmin),
        })

        // make a request to create a chart that inherits from the variable
        const response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        // fetch the parent config of the chart and verify that it's the merged etl+admin config
        const parentConfig = (
            await fetchJsonFromAdminApi(`/charts/${chartId}.parent.json`)
        )?.config
        const mergedGrapherConfig = await fetchJsonFromAdminApi(
            `/variables/mergedGrapherConfig/${variableId}.json`
        )
        expect(parentConfig).toEqual(mergedGrapherConfig)

        // fetch the full config of the chart and verify that it's been merged
        // with the indicator config
        const fullConfig = await fetchJsonFromAdminApi(
            `/charts/${chartId}.config.json`
        )

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
        const patchConfig = await fetchJsonFromAdminApi(
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
        await makeRequestAgainstAdminApi({
            method: "DELETE",
            path: `/variables/${variableId}/grapherConfigETL`,
        })

        // delete the admin config
        await makeRequestAgainstAdminApi({
            method: "DELETE",
            path: `/variables/${variableId}/grapherConfigAdmin`,
        })

        // fetch the parent config of the chart and verify there is none
        const parentConfigAfterDelete = (
            await fetchJsonFromAdminApi(`/charts/${chartId}.parent.json`)
        )?.config
        expect(parentConfigAfterDelete).toBeUndefined()

        // fetch the full config of the chart and verify that it doesn't have
        // values from the deleted ETL config
        const fullConfigAfterDelete = await fetchJsonFromAdminApi(
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
        const patchConfigAfterDelete = await fetchJsonFromAdminApi(
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
            const chartRow = await testKnexInstance!(ChartsTableName)
                .where({ id: chartId })
                .first()

            const fullConfig = await fetchJsonFromAdminApi(
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
        const chartConfigsCount = await getCountForTable(ChartConfigsTableName)
        expect(chartConfigsCount).toBe(0)

        // add grapherConfigETL for the variable
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testVariableConfigETL),
        })

        // create a chart whose parent is the given indicator
        const response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        // get the ETL config from the database
        const row = await testKnexInstance!(ChartConfigsTableName).first()
        const fullConfigETL = JSON.parse(row.full)

        // check the parent of the chart
        const parent = await fetchJsonFromAdminApi(
            `/charts/${chartId}.parent.json`
        )
        expect(parent.variableId).toEqual(variableId)
        expect(parent.config).toEqual(fullConfigETL)

        // verify that inheritance is enabled by default
        await checkInheritance({ shouldBeEnabled: true })

        // disable inheritance
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/charts/${chartId}?inheritance=disable`,
            body: JSON.stringify(testChartConfig),
        })
        await checkInheritance({ shouldBeEnabled: false })

        // enable inheritance
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/charts/${chartId}?inheritance=enable`,
            body: JSON.stringify(testChartConfig),
        })
        await checkInheritance({ shouldBeEnabled: true })

        // update the config without making changes to the inheritance setting
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify(testChartConfig),
        })
        await checkInheritance({ shouldBeEnabled: true })
    })

    it("should recompute configs when the parent of a chart changes", async () => {
        // add grapherConfigETL for the variables
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/variables/${variableId}/grapherConfigETL`,
            body: JSON.stringify(testVariableConfigETL),
        })
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/variables/${otherVariableId}/grapherConfigETL`,
            body: JSON.stringify(otherTestVariableConfig),
        })

        // create a chart whose parent is the first indicator
        const response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts?inheritance=enable",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        // check that chart inherits from the first indicator
        let fullConfig = await fetchJsonFromAdminApi(
            `/charts/${chartId}.config.json`
        )
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
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify(chartConfigWithOtherIndicatorAsParent),
        })

        // check that chart inherits from the second indicator
        fullConfig = await fetchJsonFromAdminApi(
            `/charts/${chartId}.config.json`
        )
        expect(fullConfig).toHaveProperty("note", "Other indicator note")

        // update chart config so that it doesn't inherit from an indicator
        const chartConfigWithoutDimensions = omitUndefinedValues({
            ...testChartConfig,
            dimensions: undefined,
        })
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify(chartConfigWithoutDimensions),
        })

        // check that chart doesn't inherit from any indicator
        fullConfig = await fetchJsonFromAdminApi(
            `/charts/${chartId}.config.json`
        )
        expect(fullConfig).not.toHaveProperty("note")
    })

    it("should update timestamps on chart update", async () => {
        // make sure the database is in a clean state
        const chartCount = await getCountForTable(ChartsTableName)
        expect(chartCount).toBe(0)
        const chartConfigsCount = await getCountForTable(ChartConfigsTableName)
        expect(chartConfigsCount).toBe(0)

        // make a request to create a chart
        const response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify(testChartConfig),
        })
        const chartId = response.chartId

        // helper functions to get the updatedAt timestamp of the chart and its config
        const chartUpdatedAt = async (): Promise<Date> =>
            (await testKnexInstance!(ChartsTableName).first()).updatedAt
        const configUpdatedAt = async (): Promise<Date> =>
            (await testKnexInstance!(ChartConfigsTableName).first()).updatedAt

        // verify that both updatedAt timestamps are null initially
        expect(await chartUpdatedAt()).toBeNull()
        expect(await configUpdatedAt()).toBeNull()

        // update the chart
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/charts/${chartId}`,
            body: JSON.stringify({ ...testChartConfig, title: "New title" }),
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
        const json = await makeRequestAgainstAdminApi(
            {
                method: "PUT",
                path: `/variables/${variableId}/grapherConfigETL`,
                body: JSON.stringify(invalidConfig),
            },
            { verifySuccess: false }
        )
        expect(json.success).toBe(false)
    })

    it("should return an error if the schema is invalid", async () => {
        const invalidConfig = {
            $schema: "invalid", // note that the $schema field is invalid
            title: "Title",
        }
        const json = await makeRequestAgainstAdminApi(
            {
                method: "PUT",
                path: `/variables/${variableId}/grapherConfigETL`,
                body: JSON.stringify(invalidConfig),
            },
            { verifySuccess: false }
        )
        expect(json.success).toBe(false)
    })
})
