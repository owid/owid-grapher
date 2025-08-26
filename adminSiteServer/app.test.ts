import {
    expect,
    it,
    describe,
    beforeAll,
    afterAll,
    vi,
    afterEach,
    beforeEach,
} from "vitest"

const baseDir = findProjectBaseDir(__dirname)
if (!baseDir) throw Error("Could not find project base directory")

// Mock the google docs api to retrieve files from the test-files directory
// AFAICT, we have to do this before any other code that might import googleapis
vi.mock("@googleapis/docs", async (importOriginal) => {
    const originalModule: typeof import("@googleapis/docs") =
        await importOriginal()

    return {
        ...originalModule,
        docs: vi.fn(() => ({
            documents: {
                get: vi.fn(({ documentId }) => {
                    const unparsed = fs.readFileSync(
                        path.join(
                            baseDir,
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
    }
})

import { OwidAdminApp } from "./appClass.js"

import { logInAsUser } from "./authentication.js"
import { Knex, knex } from "knex"
import { dbTestConfig } from "../db/tests/dbTestConfig.js"
import {
    TransactionCloseMode,
    getBestBreadcrumbs,
    getTagHierarchiesByChildName,
    getTopicHierarchiesByChildName,
    knexReadWriteTransaction,
    knexReadonlyTransaction,
    setKnexInstance,
    validateChartSlug,
} from "../db/db.js"
import { cleanTestDb, TABLES_IN_USE } from "../db/tests/testHelpers.js"
import {
    ChartConfigsTableName,
    ChartsTableName,
    DatasetsTableName,
    DbInsertTag,
    DbInsertTagGraphNode,
    ExplorerViewsTableName,
    MultiDimDataPagesTableName,
    MultiDimXChartConfigsTableName,
    TagsTableName,
    TagGraphTableName,
    VariablesTableName,
    TagGraphRootName,
    PostsGdocsTableName,
    OwidGdocType,
    DbInsertPostGdoc,
    DbInsertPostGdocXTag,
    PostsGdocsXTagsTableName,
    ExplorersTableName,
    JobsTableName,
    DbPlainJob,
} from "@ourworldindata/types"
import path from "path"
import fs from "fs"
import { omitUndefinedValues } from "@ourworldindata/utils"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import findProjectBaseDir from "../settings/findBaseDir.js"

const ADMIN_SERVER_HOST = "localhost"
const ADMIN_SERVER_PORT = 8765

const ADMIN_URL = `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}/admin/api`

let testKnexInstance: Knex<any, unknown[]> | undefined = undefined
let serverKnexInstance: Knex<any, unknown[]> | undefined = undefined
let app: OwidAdminApp | undefined = undefined
let cookieId: string = ""

beforeAll(async () => {
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

afterAll(async () => {
    await cleanupDb().then(() =>
        Promise.allSettled([
            app?.stopListening(),
            testKnexInstance?.destroy(),
            serverKnexInstance?.destroy(),
        ])
    )
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

describe("OwidAdminApp", { timeout: 10000 }, () => {
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
        expect(text).toBe(process.version)
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

describe(
    "OwidAdminApp: indicator-level chart configs",
    { timeout: 10000 },
    () => {
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
            const chartConfigsCount = await getCountForTable(
                ChartConfigsTableName
            )
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
                path: "/multi-dims/test%2Fcatalog%23path",
                body: JSON.stringify({ config: testMultiDimConfig }),
            })
            const mdim = await testKnexInstance!(
                MultiDimDataPagesTableName
            ).first()
            expect(mdim.catalogPath).toBe("test/catalog#path")
            expect(mdim.slug).toBe(null)
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
            }
            const fullViewConfig1 = await testKnexInstance!(
                ChartConfigsTableName
            )
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
            await testKnexInstance!(MultiDimXChartConfigsTableName).delete()
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
            const chartConfigsCount = await getCountForTable(
                ChartConfigsTableName
            )
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
            const chartConfigsCount = await getCountForTable(
                ChartConfigsTableName
            )
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
            const chartConfigsCount = await getCountForTable(
                ChartConfigsTableName
            )
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
                (await testKnexInstance!(ChartConfigsTableName).first())
                    .updatedAt

            // verify that both updatedAt timestamps are null initially
            expect(await chartUpdatedAt()).toBeNull()
            expect(await configUpdatedAt()).toBeNull()

            // update the chart
            await makeRequestAgainstAdminApi({
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
    }
)

describe("OwidAdminApp: tag graph", { timeout: 10000 }, () => {
    // prettier-ignore
    const dummyTags: DbInsertTag[] = [
        { name: TagGraphRootName, id: 1  },
        { name: "Energy and Environment", id: 2  },
        { name: "Climate & Air", id: 6 },
        { name: "Energy", slug: "energy", id: 3 },
        { name: "Nuclear Energy", slug: "nuclear-energy", id: 4 },
        { name: "CO2 & Greenhouse Gas Emissions", slug: "co2-and-greenhouse-gas-emissions", id: 5 },
      ]

    const dummyTagGraph: DbInsertTagGraphNode[] = [
        { parentId: 1, childId: 2 },
        { parentId: 2, childId: 6 },
        { parentId: 2, childId: 3, weight: 110 },
        { parentId: 6, childId: 5 },
        { parentId: 3, childId: 4 },
        { parentId: 5, childId: 4 },
    ]

    function makeDummyTopicPage(slug: string): DbInsertPostGdoc {
        return {
            slug,
            content: JSON.stringify({
                type: OwidGdocType.TopicPage,
                authors: [] as string[],
            }),
            id: slug,
            published: 1,
            publishedAt: new Date(),
            markdown: "",
        }
    }
    const dummyTopicPages: DbInsertPostGdoc[] = [
        makeDummyTopicPage("energy"),
        makeDummyTopicPage("nuclear-energy"),
        makeDummyTopicPage("co2-and-greenhouse-gas-emissions"),
    ]

    const dummyPostTags: DbInsertPostGdocXTag[] = [
        { gdocId: "energy", tagId: 3 },
        { gdocId: "nuclear-energy", tagId: 4 },
        { gdocId: "co2-and-greenhouse-gas-emissions", tagId: 5 },
    ]

    beforeEach(async () => {
        await testKnexInstance!(TagsTableName).insert(dummyTags)
        await testKnexInstance!(TagGraphTableName).insert(dummyTagGraph)
        await testKnexInstance!(PostsGdocsTableName).insert(dummyTopicPages)
        await testKnexInstance!(PostsGdocsXTagsTableName).insert(dummyPostTags)
    })
    it("should be able to see all the tags", async () => {
        const tags = await fetchJsonFromAdminApi("/tags.json")
        expect(tags).toEqual({
            tags: [
                {
                    id: 6,
                    isTopic: 0,
                    name: "Climate & Air",
                    slug: null,
                },
                {
                    id: 5,
                    isTopic: 1,
                    name: "CO2 & Greenhouse Gas Emissions",
                    slug: "co2-and-greenhouse-gas-emissions",
                },
                {
                    id: 3,
                    isTopic: 1,
                    name: "Energy",
                    slug: "energy",
                },
                {
                    id: 2,
                    isTopic: 0,
                    name: "Energy and Environment",
                    slug: null,
                },
                {
                    id: 4,
                    isTopic: 1,
                    name: "Nuclear Energy",
                    slug: "nuclear-energy",
                },
                {
                    id: 1,
                    isTopic: 0,
                    name: "tag-graph-root",
                    slug: null,
                },
            ],
        })
    })
    it("should be able to generate parent tag arrays with sub-areas", async () => {
        await knexReadonlyTransaction(async (trx) => {
            const tagHierarchiesByChildName =
                await getTagHierarchiesByChildName(trx)

            expect(
                tagHierarchiesByChildName["CO2 & Greenhouse Gas Emissions"]
            ).toEqual([
                [
                    {
                        id: 2,
                        name: "Energy and Environment",
                        slug: null,
                    },
                    {
                        id: 6,
                        name: "Climate & Air",
                        slug: null,
                    },
                    {
                        id: 5,
                        name: "CO2 & Greenhouse Gas Emissions",
                        slug: "co2-and-greenhouse-gas-emissions",
                    },
                ],
            ])
        })
    })

    it("should be able to generate parent tag arrays without sub-areas", async () => {
        await knexReadonlyTransaction(async (trx) => {
            const topicHierarchiesByChildName =
                await getTopicHierarchiesByChildName(trx)

            expect(
                topicHierarchiesByChildName["CO2 & Greenhouse Gas Emissions"]
            ).toEqual([
                [
                    {
                        id: 2,
                        name: "Energy and Environment",
                        slug: null,
                    },
                    {
                        id: 5,
                        name: "CO2 & Greenhouse Gas Emissions",
                        slug: "co2-and-greenhouse-gas-emissions",
                    },
                ],
            ])
        })
    })

    it("should be able to generate a tag graph", async () => {
        const json = await fetchJsonFromAdminApi("/flatTagGraph.json")
        expect(json).toEqual({
            "1": [
                {
                    childId: 2,
                    isTopic: 0,
                    name: "Energy and Environment",
                    slug: null,
                    parentId: 1,
                    weight: 100,
                },
            ],
            "2": [
                {
                    childId: 3,
                    isTopic: 1,
                    name: "Energy",
                    slug: "energy",
                    parentId: 2,
                    weight: 110,
                },
                {
                    childId: 6,
                    isTopic: 0,
                    name: "Climate & Air",
                    slug: null,
                    parentId: 2,
                    weight: 100,
                },
            ],
            "3": [
                {
                    childId: 4,
                    isTopic: 1,
                    name: "Nuclear Energy",
                    slug: "nuclear-energy",
                    parentId: 3,
                    weight: 100,
                },
            ],
            "5": [
                {
                    childId: 4,
                    isTopic: 1,
                    name: "Nuclear Energy",
                    slug: "nuclear-energy",
                    parentId: 5,
                    weight: 100,
                },
            ],
            "6": [
                {
                    childId: 5,
                    isTopic: 1,
                    name: "CO2 & Greenhouse Gas Emissions",
                    parentId: 6,
                    slug: "co2-and-greenhouse-gas-emissions",
                    weight: 100,
                },
            ],
            __rootId: 1,
        })
    })

    it("should be able to generate a set of breadcrumbs for a tag", async () => {
        await knexReadonlyTransaction(
            async (trx) => {
                const tagHierarchiesByChildName =
                    await getTagHierarchiesByChildName(trx)
                const breadcrumbs = getBestBreadcrumbs(
                    [
                        {
                            id: 4,
                            name: "Nuclear Energy",
                            slug: "nuclear-energy",
                        },
                    ],
                    tagHierarchiesByChildName
                )
                // breadcrumb hrefs are env-dependent, so we just assert on the labels
                const labelsOnly = breadcrumbs.map((b) => b.label)
                expect(labelsOnly).toEqual(["Energy", "Nuclear Energy"])
            },
            TransactionCloseMode.KeepOpen,
            testKnexInstance
        )
    })

    it("should generate an optimal set of breadcrumbs when given multiple tags", async () => {
        await knexReadonlyTransaction(
            async (trx) => {
                const tagHierarchiesByChildName =
                    await getTagHierarchiesByChildName(trx)
                const breadcrumbs = getBestBreadcrumbs(
                    [
                        {
                            id: 4,
                            name: "Nuclear Energy",
                            slug: "nuclear-energy",
                        },
                        {
                            id: 5,
                            name: "CO2 & Greenhouse Gas Emissions",
                            slug: "co2-and-greenhouse-gas-emissions",
                        },
                    ],
                    tagHierarchiesByChildName
                )
                // breadcrumb hrefs are env-dependent, so we just assert on the labels
                const labelsOnly = breadcrumbs.map((b) => b.label)
                expect(labelsOnly).toEqual(["Energy", "Nuclear Energy"])
            },
            TransactionCloseMode.KeepOpen,
            testKnexInstance
        )
    })
    it("should return an empty array when there are no topic tags in any of the tags' ancestors", async () => {
        await knexReadonlyTransaction(
            async (trx) => {
                const tagHierarchiesByChildName =
                    await getTagHierarchiesByChildName(trx)
                const breadcrumbs = getBestBreadcrumbs(
                    [
                        {
                            id: 2,
                            name: "Energy and Environment",
                            slug: "",
                        },
                    ],
                    tagHierarchiesByChildName
                )
                // breadcrumb hrefs are env-dependent, so we just assert on the labels
                const labelsOnly = breadcrumbs.map((b) => b.label)
                expect(labelsOnly).toEqual([])
            },
            TransactionCloseMode.KeepOpen,
            testKnexInstance
        )
    })
    it("when there are two valid paths to a given tag, it selects the longest one", async () => {
        await knexReadonlyTransaction(
            async (trx) => {
                // Here, Women's Employment has 2 paths:
                // 1. Poverty and Economic Development > Women's Employment
                // 2. Human Rights > Women's Rights > Women's Employment
                // prettier-ignore
                await testKnexInstance!(TagsTableName).insert([
                    { name: "Human Rights", id: 7 },
                    { name: "Women's Rights", slug: "womens-rights", id: 8 },
                    { name: "Women's Employment", slug: "womens-employment", id: 9 },
                    { name: "Poverty and Economic Development", id: 10 },
                ])
                await testKnexInstance!(TagGraphTableName).insert([
                    { parentId: 1, childId: 7 },
                    { parentId: 7, childId: 8 },
                    { parentId: 8, childId: 9 },
                    { parentId: 1, childId: 10 },
                    { parentId: 10, childId: 9 },
                ])
                await testKnexInstance!(PostsGdocsTableName).insert([
                    makeDummyTopicPage("womens-rights"),
                    makeDummyTopicPage("womens-employment"),
                ])
                await testKnexInstance!(PostsGdocsXTagsTableName).insert([
                    { gdocId: "womens-rights", tagId: 8 },
                    { gdocId: "womens-employment", tagId: 9 },
                ])

                const tagHierarchiesByChildName =
                    await getTagHierarchiesByChildName(trx)
                const breadcrumbs = getBestBreadcrumbs(
                    [
                        {
                            id: 9,
                            name: "Women's Employment",
                            slug: "womens-employment",
                        },
                    ],
                    tagHierarchiesByChildName
                )
                // breadcrumb hrefs are env-dependent, so we just assert on the labels
                const labelsOnly = breadcrumbs.map((b) => b.label)
                expect(labelsOnly).toEqual([
                    "Women's Rights",
                    "Women's Employment",
                ])
            },
            TransactionCloseMode.KeepOpen,
            testKnexInstance
        )
    })
})

describe("OwidAdminApp: validateChartSlug", { timeout: 10000 }, async () => {
    it("should return true for a valid chart URL", async () => {
        await testKnexInstance!(ChartConfigsTableName).insert({
            id: "0191b6c7-3629-74fd-9ebc-abcf9a99c1d2",
            patch: {},
            full: { isPublished: true, slug: "life-expectancy" },
        })
        await knexReadonlyTransaction(
            async (trx) => {
                const { isValid } = await validateChartSlug(
                    trx,
                    "https://ourworldindata.org/grapher/life-expectancy"
                )
                expect(isValid).toBe(true)
            },
            TransactionCloseMode.KeepOpen,
            testKnexInstance
        )
    })

    it("should return true for a valid explorer URL", async () => {
        await testKnexInstance!(ExplorersTableName).insert({
            slug: "migration",
            config: {
                isPublished: true,
            },
            tsv: "isPublished	true",
        })

        await knexReadonlyTransaction(async (trx) => {
            const { isValid } = await validateChartSlug(
                trx,
                "https://ourworldindata.org/explorers/migration"
            )
            expect(isValid).toBe(true)
        })

        await testKnexInstance!(ExplorersTableName)
            .where({ slug: "migration" })
            .delete()
    })
})

describe("OwidAdminApp: Explorer Views Integration", { timeout: 15000 }, () => {
    const testExplorerSlug = "test-food-prices"

    const testExplorerTsv = `explorerTitle	Test Food Prices
explorerSubtitle	Test explorer for explorer views integration.
isPublished	true
selection	Nigeria	Bangladesh
subNavId	explorers
subNavCurrentId	${testExplorerSlug}
wpBlockId
tab	map
graphers
	grapherId	Diet Radio	Cost or Affordability Radio	Affordability metric Radio
	4955	Healthy diet	Affordability	Share that cannot afford
	4958	Healthy diet	Affordability	Number that cannot afford`

    // Helper functions for testing explorer views
    async function getExplorerViewsCount(
        explorerSlug: string
    ): Promise<number> {
        const count = await testKnexInstance!(ExplorerViewsTableName)
            .where({ explorerSlug })
            .count("* as count")
            .first()
        return Number(count?.count || 0)
    }

    async function getExplorerViewsWithConfigs(explorerSlug: string) {
        return await testKnexInstance!(ExplorerViewsTableName)
            .select("dimensions", "chartConfigId", "error")
            .where({ explorerSlug })
            .orderBy("id")
    }

    async function getChartConfigsCount(): Promise<number> {
        const count = await testKnexInstance!(ChartConfigsTableName)
            .count("* as count")
            .first()
        return Number(count?.count || 0)
    }

    async function verifyChartConfigExists(
        chartConfigId: string
    ): Promise<boolean> {
        const config = await testKnexInstance!(ChartConfigsTableName)
            .where({ id: chartConfigId })
            .first()
        return !!config
    }

    it("should create explorer views when a new explorer is added via API", async () => {
        // Verify clean state
        expect(await getCountForTable(ExplorersTableName)).toBe(0)
        expect(await getCountForTable(ExplorerViewsTableName)).toBe(0)
        expect(await getChartConfigsCount()).toBe(0)

        // Create the charts that the explorer will reference
        const chart1Response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-4955",
                title: "Test Chart 4955",
                chartTypes: ["LineChart"],
            }),
        })
        const chart2Response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-4958",
                title: "Test Chart 4958",
                chartTypes: ["LineChart"],
            }),
        })

        // Update the TSV to use the actual chart IDs that were created
        const chartBasedTsv = testExplorerTsv
            .replace("4955", chart1Response.chartId.toString())
            .replace("4958", chart2Response.chartId.toString())

        // Create explorer via API
        const response = await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: chartBasedTsv,
                commitMessage: "Test explorer creation",
            }),
        })

        expect(response.success).toBe(true)

        // Check that explorer was created
        const explorerCount = await getCountForTable(ExplorersTableName)
        expect(explorerCount).toBe(1)

        // Verify the explorer exists - new explorers are initially unpublished
        const explorer = await testKnexInstance!(ExplorersTableName)
            .where({ slug: testExplorerSlug })
            .first()
        expect(explorer).toBeTruthy()
        expect(explorer.isPublished).toBe(0) // New explorers are unpublished by default (0 = false)

        // Since the explorer is not published, no views should be created initially
        const viewsCount = await getExplorerViewsCount(testExplorerSlug)
        expect(viewsCount).toBe(0)

        // Now update the explorer to be published
        // Note: the upsertExplorer function changes isPublished to false for new explorers,
        // but our original TSV has isPublished\ttrue, so we need to ensure it's set to true
        const publishedTsv = chartBasedTsv.includes("isPublished\tfalse")
            ? chartBasedTsv.replace("isPublished\tfalse", "isPublished\ttrue")
            : chartBasedTsv // TSV already has isPublished\ttrue
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: publishedTsv,
                commitMessage: "Publish explorer",
            }),
        })

        // Verify the explorer is now published and views are created
        const publishedExplorer = await testKnexInstance!(ExplorersTableName)
            .where({ slug: testExplorerSlug })
            .first()
        expect(publishedExplorer.isPublished).toBe(1) // 1 = true for published

        // Check that explorer views were created
        const publishedViewsCount =
            await getExplorerViewsCount(testExplorerSlug)
        expect(publishedViewsCount).toBeGreaterThan(0)

        // Verify view structure
        const views = await getExplorerViewsWithConfigs(testExplorerSlug)
        expect(views.length).toBe(2) // Two charts in our test data

        // Check that each view has the expected structure
        for (const view of views) {
            expect(view.dimensions).toBeTruthy()

            // Parse the explorer view JSON
            const parsedView = JSON.parse(view.dimensions)
            // The actual property names are simpler (without "Radio" suffix)
            expect(parsedView).toHaveProperty("Diet", "Healthy diet")
            expect(parsedView).toHaveProperty(
                "Cost or Affordability",
                "Affordability"
            )
            expect(parsedView).toHaveProperty("Affordability metric")

            // Either should have a chartConfigId or an error, but not both
            if (view.chartConfigId) {
                expect(view.error).toBeNull()
                expect(await verifyChartConfigExists(view.chartConfigId)).toBe(
                    true
                )
            } else {
                expect(view.error).toBeTruthy()
                expect(view.chartConfigId).toBeNull()
            }
        }

        // Check that chart configs were created for successful views
        const successfulViews = views.filter((v) => v.chartConfigId)
        const finalChartConfigsCount = await getChartConfigsCount()
        // Should have at least the original 2 charts plus configs for successful views
        expect(finalChartConfigsCount).toBeGreaterThanOrEqual(
            2 + successfulViews.length
        )
    })

    it("should update explorer views when an explorer is modified via API", async () => {
        // Create the charts that the explorer will reference
        const chart1Response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-update-4955",
                title: "Test Update Chart 4955",
                chartTypes: ["LineChart"],
            }),
        })
        const chart2Response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-update-4958",
                title: "Test Update Chart 4958",
                chartTypes: ["LineChart"],
            }),
        })
        const chart3Response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-update-4954",
                title: "Test Update Chart 4954",
                chartTypes: ["LineChart"],
            }),
        })

        // Create initial published explorer
        const initialTsv = testExplorerTsv
            .replace("4955", chart1Response.chartId.toString())
            .replace("4958", chart2Response.chartId.toString())

        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: initialTsv,
                commitMessage: "Initial explorer creation",
            }),
        })

        const initialViewsCount = await getExplorerViewsCount(testExplorerSlug)

        // Update the explorer with modified TSV (add a third chart)
        const updatedTsv =
            initialTsv +
            `\n\t${chart3Response.chartId}\tNutrient adequate diet\tAffordability\tShare that cannot afford`

        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: updatedTsv,
                commitMessage: "Add third chart option",
            }),
        })

        // Check that views were updated
        const updatedViewsCount = await getExplorerViewsCount(testExplorerSlug)
        expect(updatedViewsCount).toBe(3) // Should now have 3 views
        expect(updatedViewsCount).toBeGreaterThan(initialViewsCount)

        // Verify the new view exists
        const views = await getExplorerViewsWithConfigs(testExplorerSlug)
        const nutrientAdequateView = views.find((v) => {
            const parsed = JSON.parse(v.dimensions)
            return parsed["Diet"] === "Nutrient adequate diet"
        })
        expect(nutrientAdequateView).toBeTruthy()

        // Chart configs should have been created for any new successful views
        const finalChartConfigsCount = await getChartConfigsCount()
        // Should have original 3 charts plus configs for successful views
        expect(finalChartConfigsCount).toBeGreaterThanOrEqual(3)
    })

    it("should clean up explorer views when explorer is deleted via API", async () => {
        // Create the charts that the explorer will reference
        const chart1Response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-delete-4955",
                title: "Test Delete Chart 4955",
                chartTypes: ["LineChart"],
            }),
        })
        const chart2Response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-delete-4958",
                title: "Test Delete Chart 4958",
                chartTypes: ["LineChart"],
            }),
        })

        // Update the TSV to use the actual chart IDs that were created
        const chartBasedTsv = testExplorerTsv
            .replace("4955", chart1Response.chartId.toString())
            .replace("4958", chart2Response.chartId.toString())

        // Create explorer first
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: chartBasedTsv,
                commitMessage: "Test deletion cleanup",
            }),
        })

        // New explorers are automatically unpublished, so update to publish it
        const publishedTsv = chartBasedTsv.includes("isPublished\tfalse")
            ? chartBasedTsv.replace("isPublished\tfalse", "isPublished\ttrue")
            : chartBasedTsv // TSV already has isPublished\ttrue
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: publishedTsv,
                commitMessage: "Publish explorer for deletion test",
            }),
        })

        const initialViewsCount = await getExplorerViewsCount(testExplorerSlug)
        expect(initialViewsCount).toBeGreaterThan(0)

        // Get chart config IDs before deletion
        const views = await getExplorerViewsWithConfigs(testExplorerSlug)
        const chartConfigIds = views
            .filter((v) => v.chartConfigId)
            .map((v) => v.chartConfigId)

        // Delete the explorer via API
        await makeRequestAgainstAdminApi({
            method: "DELETE",
            path: `/explorers/${testExplorerSlug}`,
        })

        // Verify explorer is deleted
        const explorerExists = await testKnexInstance!(ExplorersTableName)
            .where({ slug: testExplorerSlug })
            .first()
        expect(explorerExists).toBeFalsy()

        // Verify all explorer views are deleted (CASCADE)
        const remainingViews = await getExplorerViewsCount(testExplorerSlug)
        expect(remainingViews).toBe(0)

        // Verify chart configs are deleted (CASCADE from explorer_views)
        for (const chartConfigId of chartConfigIds) {
            const configExists = await verifyChartConfigExists(chartConfigId)
            expect(configExists).toBe(false)
        }

        const finalChartConfigsCount = await getChartConfigsCount()
        // Should only have the original 2 test charts left (explorer view configs are deleted)
        expect(finalChartConfigsCount).toBe(2)
    })

    it("should handle error cases gracefully", async () => {
        // Create an explorer with invalid grapher IDs that will cause errors
        const invalidTsv = `explorerTitle	Invalid Test Explorer
explorerSubtitle	Explorer with invalid grapher IDs.
isPublished	true
selection	Nigeria	Bangladesh
subNavId	explorers
subNavCurrentId	test-invalid
wpBlockId
tab	map
graphers
	grapherId	Diet Radio	Cost or Affordability Radio	Affordability metric Radio
	99999	Healthy diet	Affordability	Share that cannot afford
	99998	Healthy diet	Affordability	Number that cannot afford`

        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: "/explorers/test-invalid",
            body: JSON.stringify({
                tsv: invalidTsv,
                commitMessage: "Test error handling",
            }),
        })

        // New explorers are automatically unpublished, so update to publish it
        // This allows explorer views to be created even for invalid chart IDs (they'll have errors)
        const publishedInvalidTsv = invalidTsv.includes("isPublished\tfalse")
            ? invalidTsv.replace("isPublished\tfalse", "isPublished\ttrue")
            : invalidTsv // TSV already has isPublished\ttrue
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: "/explorers/test-invalid",
            body: JSON.stringify({
                tsv: publishedInvalidTsv,
                commitMessage: "Publish explorer for error test",
            }),
        })

        // Views should still be created but with error messages
        const viewsCount = await getExplorerViewsCount("test-invalid")
        expect(viewsCount).toBeGreaterThan(0)

        const views = await getExplorerViewsWithConfigs("test-invalid")

        // All views should have errors due to invalid grapher IDs
        for (const view of views) {
            expect(view.error).toBeTruthy()
            expect(view.chartConfigId).toBeNull()
            expect(view.error.length).toBeLessThanOrEqual(500) // Error message truncation
        }

        // No chart configs should be created for failed views
        const chartConfigsCount = await getChartConfigsCount()
        expect(chartConfigsCount).toBe(0)
    })

    it("should handle unpublished explorers correctly", async () => {
        // Create an unpublished explorer
        const unpublishedTsv = testExplorerTsv.replace(
            "isPublished	true",
            "isPublished	false"
        )

        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/explorers/test-unpublished`,
            body: JSON.stringify({
                tsv: unpublishedTsv,
                commitMessage: "Test unpublished explorer",
            }),
        })

        // Verify explorer exists but is not published
        const explorer = await testKnexInstance!(ExplorersTableName)
            .where({ slug: "test-unpublished" })
            .first()
        expect(explorer).toBeTruthy()
        expect(explorer.isPublished).toBe(0) // 0 = false for unpublished

        // No explorer views should be created for unpublished explorers
        const viewsCount = await getExplorerViewsCount("test-unpublished")
        expect(viewsCount).toBe(0)

        // No chart configs should be created
        const chartConfigsCount = await getChartConfigsCount()
        expect(chartConfigsCount).toBe(0)
    })

    it("should verify explorer view JSON structure and parameter accuracy", async () => {
        // Create the charts that the explorer will reference
        const chart1Response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-json-4955",
                title: "Test JSON Chart 4955",
                chartTypes: ["LineChart"],
            }),
        })
        const chart2Response = await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-json-4958",
                title: "Test JSON Chart 4958",
                chartTypes: ["LineChart"],
            }),
        })

        // Update the TSV to use the actual chart IDs that were created
        const chartBasedTsv = testExplorerTsv
            .replace("4955", chart1Response.chartId.toString())
            .replace("4958", chart2Response.chartId.toString())

        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: chartBasedTsv,
                commitMessage: "Test JSON structure",
            }),
        })

        // New explorers are automatically unpublished, so update to publish it
        const publishedTsv = chartBasedTsv.includes("isPublished\tfalse")
            ? chartBasedTsv.replace("isPublished\tfalse", "isPublished\ttrue")
            : chartBasedTsv // TSV already has isPublished\ttrue
        await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: publishedTsv,
                commitMessage: "Publish explorer for JSON test",
            }),
        })

        const views = await getExplorerViewsWithConfigs(testExplorerSlug)
        expect(views.length).toBe(2)

        // Verify each view has properly structured JSON
        const expectedParams = [
            {
                Diet: "Healthy diet",
                "Cost or Affordability": "Affordability",
                "Affordability metric": "Share that cannot afford",
            },
            {
                Diet: "Healthy diet",
                "Cost or Affordability": "Affordability",
                "Affordability metric": "Number that cannot afford",
            },
        ]

        for (let i = 0; i < views.length; i++) {
            const view = views[i]
            const parsedView = JSON.parse(view.dimensions)

            // Verify structure matches expected parameters
            expect(parsedView).toEqual(expectedParams[i])

            // Verify JSON keys are consistently ordered (alphabetical)
            // Sort keys client-side since MySQL doesn't guarantee JSON key order
            const keys = Object.keys(parsedView).sort()
            const expectedKeys = Object.keys(expectedParams[i]).sort()
            expect(keys).toEqual(expectedKeys)
        }
    })

    it("should process explorer views asynchronously via job queue", async () => {
        const testExplorerSlug = "test-async-explorer"

        // Step 1: Create charts that the explorer will reference
        const chart1Id = 1
        const chart2Id = 2

        await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-1",
                title: "Test Chart 1",
                chartTypes: ["LineChart"],
            }),
        })

        await makeRequestAgainstAdminApi({
            method: "POST",
            path: "/charts",
            body: JSON.stringify({
                $schema: latestGrapherConfigSchema,
                slug: "test-chart-2",
                title: "Test Chart 2",
                chartTypes: ["ScatterPlot"],
            }),
        })

        // Step 2: Create explorer via API (should be queued for async processing)
        const explorerTsv = `explorerTitle	Test Async Explorer
explorerSubtitle	Test explorer for async job queue processing.
isPublished	true
selection	Afghanistan	Albania
subNavId	explorers
		yVariableIds	xVariableId	colorVariableId
Line Chart	${chart1Id}	123	456	789
Scatter	${chart2Id}	124	457	790`

        const response = await makeRequestAgainstAdminApi({
            method: "PUT",
            path: `/explorers/${testExplorerSlug}`,
            body: JSON.stringify({
                tsv: explorerTsv,
                commitMessage: "Test async explorer creation",
            }),
        }) // API returns 200 OK but with queued status

        // Step 3: Verify API returns success with queued status
        expect(response.success).toBe(true)
        expect(response.status).toBe("queued")
        expect(response.message).toContain("asynchronously")

        // Step 4: Verify explorer was created with correct refresh status
        const explorer = await testKnexInstance!(ExplorersTableName)
            .where({ slug: testExplorerSlug })
            .first()

        expect(explorer).toBeTruthy()
        expect(explorer.viewsRefreshStatus).toBe("queued")
        expect(explorer.lastViewsRefreshAt).toBeNull()

        // Step 5: Verify job was queued
        const job = await testKnexInstance!(JobsTableName)
            .where({ type: "refresh_explorer_views", slug: testExplorerSlug })
            .first()

        expect(job).toBeTruthy()
        expect(job.state).toBe("queued")
        expect(job.attempts).toBe(0)
        expect(job.explorerUpdatedAt).toBeTruthy()

        // Step 6: Verify no explorer views exist yet (async processing not done)
        const viewsCountBefore = await getCountForTable(ExplorerViewsTableName)
        expect(viewsCountBefore).toBe(0)

        // Step 7: Process one job from the queue using serverUtils
        const { processOneExplorerViewsJob } = await import(
            "../jobQueue/explorerJobProcessor.js"
        )

        const jobProcessed = await processOneExplorerViewsJob()
        expect(jobProcessed).toBe(true) // Job was found and processed

        // Step 8: Verify job was marked as completed
        const completedJob = (await testKnexInstance!(JobsTableName)
            .where({ id: job.id })
            .first()) as DbPlainJob

        expect(completedJob.state).toBe("done")
        expect(completedJob.lastError).toBeNull()

        // Step 9: Verify explorer refresh status was updated
        const updatedExplorer = await testKnexInstance!(ExplorersTableName)
            .where({ slug: testExplorerSlug })
            .first()

        expect(updatedExplorer.viewsRefreshStatus).toBe("clean")
        expect(updatedExplorer.lastViewsRefreshAt).toBeTruthy()

        // Step 10: Verify explorer views were created correctly
        const viewsCountAfter = await getCountForTable(ExplorerViewsTableName)
        expect(viewsCountAfter).toBe(2) // Should have 2 views (LineChart and Scatter)

        // Step 11: Verify the content of the created views
        const createdViews = await testKnexInstance!(ExplorerViewsTableName)
            .where({ explorerSlug: testExplorerSlug })
            .select("dimensions", "chartConfigId", "error")
            .orderBy("id")

        expect(createdViews).toHaveLength(2)

        // Both views should have valid chart configs (no errors)
        expect(createdViews[0].error).toBeNull()
        expect(createdViews[1].error).toBeNull()
        expect(createdViews[0].chartConfigId).toBeTruthy()
        expect(createdViews[1].chartConfigId).toBeTruthy()

        // Verify view dimensions contain the expected parameters
        const view1Params = JSON.parse(createdViews[0].dimensions)
        const view2Params = JSON.parse(createdViews[1].dimensions)

        expect(view1Params.yVariableIds).toBe("123")
        expect(view2Params.yVariableIds).toBe("124")

        // Step 12: Verify no more jobs are pending
        const remainingJobs = await testKnexInstance!(JobsTableName)
            .where({ state: "queued" })
            .count()
        expect(remainingJobs[0]["count(*)"] as number).toBe(0)
    })
})
