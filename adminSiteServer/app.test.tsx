import { OwidAdminApp } from "./appClass.js"
import { jest } from "@jest/globals"
import { logInAsUser } from "./authentication.js"
import knex, { Knex } from "knex"
import { dbTestConfig } from "../db/tests/dbTestConfig.js"
import sqlFixtures from "sql-fixtures"
import {
    TransactionCloseMode,
    knexReadonlyTransaction,
    setKnexInstance,
} from "../db/db.js"
import { cleanTestDb } from "../db/tests/testHelpers.js"

jest.setTimeout(10000) // wait for up to 10s for the app server to start
let testKnexInstance: Knex<any, unknown[]> | undefined = undefined
let serverKnexInstance: Knex<any, unknown[]> | undefined = undefined
let app: OwidAdminApp | undefined = undefined
let cookieId: string = ""

beforeAll(async () => {
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
    testKnexInstance = knex(dbTestConfig)
    serverKnexInstance = knex(dbTestConfig)
    await cleanTestDb(testKnexInstance)

    const fixturesCreator = new sqlFixtures(testKnexInstance)
    await fixturesCreator.create(dataSpec)
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

afterAll((done: any) => {
    // We leave the user in the database for other tests to use
    // For other cases it is good to drop any rows created in the test
    void Promise.allSettled([
        app?.stopListening(),
        testKnexInstance?.destroy(),
        serverKnexInstance?.destroy(),
    ]).then(() => done())
})

describe("OwidAdminApp", () => {
    it("should be able to create an app", () => {
        expect(app).toBeTruthy()
        expect(app!.server).toBeTruthy()
    })

    it("should be able to fetch the version from the server", async () => {
        const _ = await knexReadonlyTransaction(
            async (trx) => {
                const nodeVersion = await fetch(
                    "http://localhost:8765/admin/nodeVersion",
                    {
                        headers: { cookie: `sessionid=${cookieId}` },
                    }
                )
                expect(nodeVersion.status).toBe(200)
                const text = await nodeVersion.text()
                expect(text).toBe("v18.16.1")
            },
            TransactionCloseMode.KeepOpen,
            testKnexInstance
        )
    })

    it("should be able to add a new chart via the api", async () => {
        const _ = await knexReadonlyTransaction(async (trx) => {
            const response = await fetch(
                "http://localhost:8765/admin/api/charts",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        cookie: `sessionid=${cookieId}`,
                    },
                    body: JSON.stringify({
                        title: "Test chart",
                        slug: "test-chart",
                        config: {
                            type: "LineChart",
                        },
                    }),
                }
            )
            expect(response.status).toBe(200)
            const text = await response.json()
            expect(text.success).toBe(true)
        })
    })
})
