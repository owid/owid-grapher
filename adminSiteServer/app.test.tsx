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
    knexRaw,
    knexReadWriteTransaction,
    setKnexInstance,
} from "../db/db.js"
import { cleanTestDb } from "../db/tests/testHelpers.js"
import { ChartsTableName } from "@ourworldindata/types"
import path from "path"
import fs from "fs"

jest.setTimeout(10000) // wait for up to 10s for the app server to start
let testKnexInstance: Knex<any, unknown[]> | undefined = undefined
let serverKnexInstance: Knex<any, unknown[]> | undefined = undefined
let app: OwidAdminApp | undefined = undefined
let cookieId: string = ""

beforeAll(async () => {
    // jest.setup.js
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

    app = new OwidAdminApp({ isDev: true, gitCmsDir: "", quiet: true })
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
    await knexReadWriteTransaction(
        async (trx) => {
            await knexRaw(trx, `DELETE FROM posts_gdocs`, [])
        },
        TransactionCloseMode.KeepOpen,
        testKnexInstance
    )
}

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
    const count = await testKnexInstance!.table(tableName).count()
    return count[0]["count(*)"] as number
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

    it("should be able to add a new chart via the api", async () => {
        const chartCount = await getCountForTable(ChartsTableName)
        expect(chartCount).toBe(0)
        const response = await fetch("http://localhost:8765/admin/api/charts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                cookie: `sessionid=${cookieId}`,
            },
            body: JSON.stringify({
                slug: "test-chart",
                config: {
                    title: "Test chart",
                    type: "LineChart",
                },
            }),
        })
        expect(response.status).toBe(200)
        const text = await response.json()
        expect(text.success).toBe(true)

        const chartCountAfter = await getCountForTable(ChartsTableName)
        expect(chartCountAfter).toBe(1)
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
        const gdocResponse = await fetch(
            `http://localhost:8765/admin/api/gdocs/${gdocId}`,
            {
                headers: { cookie: `sessionid=${cookieId}` },
            }
        )
        expect(gdocResponse.status).toBe(200)
        const gdoc = await gdocResponse.json()
        expect(gdoc.id).toBe(gdocId)
        expect(gdoc.content.title).toBe("Basic article")
    })
})
