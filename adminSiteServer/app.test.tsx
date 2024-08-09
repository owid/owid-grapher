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
    VariablesTableName,
} from "@ourworldindata/types"
import { defaultGrapherConfig } from "@ourworldindata/grapher"
import path from "path"
import fs from "fs"

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
    await app.startListening(8765, "localhost")
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
                await trx.raw(`DELETE FROM ${table}`)
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

async function fetchJsonFromApi(path: string) {
    const url = `http://localhost:8765/admin/api${path}`
    const response = await fetch(url, {
        headers: { cookie: `sessionid=${cookieId}` },
    })
    expect(response.status).toBe(200)
    return await response.json()
}

const currentSchema = defaultGrapherConfig["$schema"]
const testChartConfig = {
    slug: "test-chart",
    title: "Test chart",
    type: "LineChart",
}

describe("OwidAdminApp", () => {
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
        const response = await fetch("http://localhost:8765/admin/api/charts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                cookie: `sessionid=${cookieId}`,
            },
            body: JSON.stringify(testChartConfig),
        })
        expect(response.status).toBe(200)
        const text = await response.json()
        expect(text.success).toBe(true)
        expect(text.chartId).toBe(chartId)

        // check that a row in the charts table has been added
        const chartCountAfter = await getCountForTable(ChartsTableName)
        expect(chartCountAfter).toBe(1)

        // check that a row in the chart_configs table has been added
        const chartConfigsCountAfter = await getCountForTable(
            ChartConfigsTableName
        )
        expect(chartConfigsCountAfter).toBe(1)

        // fetch the parent config and verify it's empty
        const parentConfig = await fetchJsonFromApi(
            `/charts/${chartId}.parentConfig.json`
        )
        expect(parentConfig).toEqual({})

        // fetch the full config and verify it's merged with the default
        const fullConfig = await fetchJsonFromApi(
            `/charts/${chartId}.config.json`
        )
        expect(fullConfig).toHaveProperty("$schema", currentSchema)
        expect(fullConfig).toHaveProperty("id", chartId) // must match the db id
        expect(fullConfig).toHaveProperty("version", 1) // added version
        expect(fullConfig).toHaveProperty("slug", "test-chart")
        expect(fullConfig).toHaveProperty("title", "Test chart")
        expect(fullConfig).toHaveProperty("type", "LineChart") // default property
        expect(fullConfig).toHaveProperty("tab", "chart") // default property

        // fetch the patch config and verify it's diffed correctly
        const patchConfig = await fetchJsonFromApi(
            `/charts/${chartId}.patchConfig.json`
        )
        expect(patchConfig).toEqual({
            $schema: defaultGrapherConfig["$schema"],
            id: chartId,
            version: 1,
            slug: "test-chart",
            title: "Test chart",
            // note that the type is not included
        })
    })

    it("should be able to create a GDoc article", async () => {
        const gdocId = "gdoc-test-create-1"
        const response = await fetch(
            `http://localhost:8765/admin/api/gdocs/${gdocId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    cookie: `sessionid=${cookieId}`,
                },
            }
        )
        expect(response.status).toBe(200)

        const text = await response.json()
        expect(text.id).toBe(gdocId)

        // Fetch the GDoc to verify it was created
        const gdoc = await fetchJsonFromApi(`/gdocs/${gdocId}`)
        expect(gdoc.id).toBe(gdocId)
        expect(gdoc.content.title).toBe("Basic article")
    })
})

describe("OwidAdminApp: indicator-level chart configs", () => {
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

    const testVariableConfig = {
        hasMapTab: true,
        note: "Indicator note",
        selectedEntityNames: ["France", "Italy", "Spain"],
        hideRelativeToggle: false,
    }

    const testChartConfig = {
        slug: "test-chart",
        title: "Test chart",
        type: "Marimekko",
        selectedEntityNames: [],
        hideRelativeToggle: false,
        dimensions: [
            {
                variableId,
                property: "y",
            },
        ],
    }

    beforeEach(async () => {
        await testKnexInstance!(DatasetsTableName).insert([dummyDataset])
        await testKnexInstance!(VariablesTableName).insert([dummyVariable])
    })

    it("should be able to edit ETL grapher configs via the api", async () => {
        // make sure the database is in a clean state
        const chartConfigsCount = await getCountForTable(ChartConfigsTableName)
        expect(chartConfigsCount).toBe(0)

        // add a grapher config for a variable
        let response = await fetch(
            `http://localhost:8765/admin/api/variables/${variableId}/grapherConfigETL`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    cookie: `sessionid=${cookieId}`,
                },
                body: JSON.stringify(testVariableConfig),
            }
        )
        expect(response.status).toBe(200)
        let text = await response.json()
        expect(text.success).toBe(true)

        // check that a row in the chart_configs table has been added
        const chartConfigsCountAfter = await getCountForTable(
            ChartConfigsTableName
        )
        expect(chartConfigsCountAfter).toBe(1)

        // get inserted configs from the database
        const row = await testKnexInstance!(ChartConfigsTableName).first()
        const patchConfig = JSON.parse(row.patch)
        const fullConfig = JSON.parse(row.full)

        // for ETL configs, patch and full configs should be the same
        expect(patchConfig).toEqual(fullConfig)

        // check that $schema and dimensions field were added to the config
        expect(patchConfig).toEqual({
            ...testVariableConfig,
            $schema: currentSchema,
            dimensions: [
                {
                    property: "y",
                    variableId,
                },
            ],
        })

        // fetch the admin+etl merged grapher config
        const mergedGrapherConfig = await fetchJsonFromApi(
            `/variables/mergedGrapherConfig/${variableId}.json`
        )

        // since no admin-authored config exists, the merged config should be
        // the same as the ETL config
        expect(mergedGrapherConfig).toEqual(fullConfig)

        // delete the grapher config we just added
        response = await fetch(
            `http://localhost:8765/admin/api/variables/${variableId}/grapherConfigETL`,
            {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    cookie: `sessionid=${cookieId}`,
                },
            }
        )
        expect(response.status).toBe(200)
        text = await response.json()
        expect(text.success).toBe(true)

        // check that the row in the chart_configs table has been deleted
        const chartConfigsCountAfterDelete = await getCountForTable(
            ChartConfigsTableName
        )
        expect(chartConfigsCountAfterDelete).toBe(0)
    })

    it("should update all charts that inherit from an indicator", async () => {
        const chartId = 2 // since it's the second chart to be inserted into the test database

        // setup: add grapherConfigETL for the variable
        let response = await fetch(
            `http://localhost:8765/admin/api/variables/${variableId}/grapherConfigETL`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    cookie: `sessionid=${cookieId}`,
                },
                body: JSON.stringify(testVariableConfig),
            }
        )
        expect(response.status).toBe(200)
        let text = await response.json()
        expect(text.success).toBe(true)

        // make a request to create a chart that inherits from the variable
        response = await fetch("http://localhost:8765/admin/api/charts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                cookie: `sessionid=${cookieId}`,
            },
            body: JSON.stringify(testChartConfig),
        })
        expect(response.status).toBe(200)
        text = await response.json()
        expect(text.success).toBe(true)
        expect(text.chartId).toBe(chartId)

        // get the ETL config from the database
        const row = await testKnexInstance!(ChartConfigsTableName).first()
        const fullConfigETL = JSON.parse(row.full)

        // fetch the parent config of the chart and verify that it's the ETL config
        const parentConfig = await fetchJsonFromApi(
            `/charts/${chartId}.parentConfig.json`
        )
        expect(parentConfig).toEqual(fullConfigETL)

        // fetch the full config of the chart and verify that it's been merged
        // with the ETL config and the default config
        const fullConfig = await fetchJsonFromApi(
            `/charts/${chartId}.config.json`
        )
        expect(fullConfig).toHaveProperty("slug", "test-chart")
        expect(fullConfig).toHaveProperty("title", "Test chart")
        expect(fullConfig).toHaveProperty("type", "Marimekko")
        expect(fullConfig).toHaveProperty("selectedEntityNames", [])
        expect(fullConfig).toHaveProperty("hideRelativeToggle", false)
        expect(fullConfig).toHaveProperty("note", "Indicator note") // inherited from variable
        expect(fullConfig).toHaveProperty("hasMapTab", true) // inherited from variable
        expect(fullConfig).toHaveProperty("tab", "chart") // default value

        // fetch the patch config and verify it's diffed correctly
        const patchConfig = await fetchJsonFromApi(
            `/charts/${chartId}.patchConfig.json`
        )
        expect(patchConfig).toEqual({
            $schema: defaultGrapherConfig["$schema"],
            id: chartId,
            version: 1,
            slug: "test-chart",
            title: "Test chart",
            type: "Marimekko",
            selectedEntityNames: [],
            dimensions: [
                {
                    variableId,
                    property: "y",
                },
            ],
            // note that `hideRelativeToggle` is not included
        })

        // delete the ETL config
        response = await fetch(
            `http://localhost:8765/admin/api/variables/${variableId}/grapherConfigETL`,
            {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    cookie: `sessionid=${cookieId}`,
                },
            }
        )
        expect(response.status).toBe(200)
        text = await response.json()
        expect(text.success).toBe(true)

        // fetch the parent config of the chart and verify that it's empty
        const parentConfigAfterDelete = await fetchJsonFromApi(
            `/charts/${chartId}.parentConfig.json`
        )
        expect(parentConfigAfterDelete).toEqual({})

        // fetch the full config of the chart and verify that it doesn't have
        // values from the deleted ETL config
        const fullConfigAfterDelete = await fetchJsonFromApi(
            `/charts/${chartId}.config.json`
        )
        // was inherited from variable, should be unset now
        expect(fullConfigAfterDelete).not.toHaveProperty("note")
        // was inherited from variable, is now inherited from the default config
        expect(fullConfigAfterDelete).toHaveProperty("hasMapTab", false)
        // was inherited from variable, is now inherited from the default config
        // (although the "original" chart config sets hideRelativeToggle to false)
        expect(fullConfigAfterDelete).toHaveProperty("hideRelativeToggle", true)
        expect(fullConfigAfterDelete).toHaveProperty("tab", "chart") // default value

        // fetch the patch config and verify it's diffed correctly
        const patchConfigAfterDelete = await fetchJsonFromApi(
            `/charts/${chartId}.patchConfig.json`
        )
        expect(patchConfigAfterDelete).toEqual({
            $schema: defaultGrapherConfig["$schema"],
            id: chartId,
            version: 1,
            slug: "test-chart",
            title: "Test chart",
            type: "Marimekko",
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
})
