import { beforeAll, afterAll, afterEach, expect } from "vitest"
import type { Knex } from "knex"
import { OwidAdminApp } from "../appClass.js"
import {
    resetDbButKeepBaselines,
    setupAdminTestDatabase,
} from "./adminTestDb.js"

// Fixed port is okay while DB tests run serially
const ADMIN_SERVER_HOST = "localhost"
const ADMIN_SERVER_PORT = 8765

export interface TestEnv {
    testKnex: Knex
    serverKnex: Knex
    app: OwidAdminApp
    baseUrl: string
    apiKey: string
    userId: number
    // Helpers
    fetchJson(path: string): Promise<any>
    request(arg: {
        method: "POST" | "PUT" | "PATCH" | "DELETE"
        path: string
        body?: string
    }): Promise<any>
    getCount(tableName: string): Promise<number>
}

let testKnex: Knex | undefined
let serverKnex: Knex | undefined
let app: OwidAdminApp | undefined
let adminApiKey: string | undefined
let seededUserId: number | undefined

const ADMIN_URL = `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}/admin/api`

export function getAdminTestEnv(): TestEnv {
    beforeAll(async () => {
        const database = await setupAdminTestDatabase()
        testKnex = database.testKnex
        serverKnex = database.serverKnex
        seededUserId = database.userId
        adminApiKey = database.apiKey

        app = new OwidAdminApp({ isDev: true, isTest: true, quiet: true })
        await app.startListening(ADMIN_SERVER_PORT, ADMIN_SERVER_HOST)
    })

    afterEach(async () => {
        await resetDbButKeepBaselines(testKnex!)
    })

    afterAll(async () => {
        await resetDbButKeepBaselines(testKnex!)
        await Promise.allSettled([
            app?.stopListening(),
            testKnex?.destroy(),
            serverKnex?.destroy(),
        ])
    })

    async function getCount(tableName: string): Promise<number> {
        const count = await testKnex!.table(tableName).count()
        return count[0]["count(*)"] as number
    }

    async function fetchJson(p: string): Promise<any> {
        const url = ADMIN_URL + p
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${adminApiKey}`,
            },
        })
        expect(response.status).toBe(200)
        return await response.json()
    }

    async function request(arg: {
        method: "POST" | "PUT" | "PATCH" | "DELETE"
        path: string
        body?: string
    }): Promise<any> {
        const url = ADMIN_URL + arg.path
        const response = await fetch(url, {
            method: arg.method,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${adminApiKey}`,
            },
            body: arg.body,
        })
        expect(response.status).toBe(200)
        return await response.json()
    }

    return {
        get testKnex() {
            return testKnex!
        },
        get serverKnex() {
            return serverKnex!
        },
        get app() {
            return app!
        },
        baseUrl: ADMIN_URL,
        get apiKey() {
            return adminApiKey!
        },
        get userId() {
            return seededUserId!
        },
        fetchJson,
        request,
        getCount,
    }
}
