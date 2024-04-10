import { OwidAdminApp } from "./appClass.js"
import { jest } from "@jest/globals"
import { logInAsUser } from "./authentication.js"
import knex, { Knex } from "knex"
import { dbTestConfig } from "../db/tests/dbTestConfig.js"
import sqlFixtures from "sql-fixtures"
import {
    TransactionCloseMode,
    knexReadWriteTransaction,
    setKnexInstance,
} from "../db/db.js"
import { cleanTestDb } from "../db/tests/testHelpers.js"

jest.setTimeout(10000) // wait for up to 10s for the app server to start
let testKnexInstance: Knex<any, unknown[]> | undefined = undefined
let serverKnexInstance: Knex<any, unknown[]> | undefined = undefined

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
})

afterAll((done: any) => {
    // We leave the user in the database for other tests to use
    // For other cases it is good to drop any rows created in the test
    void Promise.allSettled([
        testKnexInstance?.destroy(),
        serverKnexInstance?.destroy(),
    ]).then(() => done())
})

describe("OwidAdminApp", () => {
    const app = new OwidAdminApp({ isDev: true, gitCmsDir: "", quiet: true })

    it("should be able to create an app", () => {
        expect(app).toBeTruthy()
    })

    it("should be able to start the app", async () => {
        await app.startListening(8765, "localhost")
        console.error("Server started")
        expect(app.server).toBeTruthy()
        const _ = await knexReadWriteTransaction(
            async (trx) => {
                console.error("Transaction started")
                const cookieId = await logInAsUser({
                    email: "admin@example.com",
                    id: 1,
                })
                console.error("Logged in")
                const bla = await fetch(
                    "http://localhost:8765/admin/nodeVersion",
                    {
                        headers: { cookie: `sessionid=${cookieId.id}` },
                    }
                )
                console.error("fetched")
                expect(bla.status).toBe(200)
                const text = await bla.text()
                console.error("text", text)
                expect(text).toBe("v18.16.1")
            },
            TransactionCloseMode.Close,
            testKnexInstance
        )
        console.error("Transaction done")
        await app.stopListening()
        console.error("Server stopped")
    })
})
