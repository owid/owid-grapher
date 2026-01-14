import { beforeAll, afterAll, afterEach, expect } from "vitest"
import knex, { Knex } from "knex"
import { dbTestConfig } from "../../db/tests/dbTestConfig.js"
import { OwidAdminApp } from "../appClass.js"
import {
    TransactionCloseMode,
    knexReadWriteTransaction,
    setKnexInstance,
} from "../../db/db.js"
import { TABLES_IN_USE } from "../../db/tests/testHelpers.js"
import { AdminApiKeysTableName, UsersTableName } from "@ourworldindata/types"
import { createApiKey, hashApiKey } from "../../serverUtils/apiKey.js"

// Fixed port is okay while DB tests run serially
const ADMIN_SERVER_HOST = "localhost"
const ADMIN_SERVER_PORT = 8765

export interface TestEnv {
    testKnex: Knex<any, unknown[]>
    serverKnex: Knex<any, unknown[]>
    app: OwidAdminApp
    baseUrl: string
    apiKey: string
    // Helpers
    fetchJson(path: string): Promise<any>
    request(arg: {
        method: "POST" | "PUT" | "DELETE"
        path: string
        body?: string
    }): Promise<any>
    getCount(tableName: string): Promise<number>
}

let testKnex: Knex<any, unknown[]> | undefined
let serverKnex: Knex<any, unknown[]> | undefined
let app: OwidAdminApp | undefined
let adminApiKey: string | undefined

const ADMIN_URL = `http://${ADMIN_SERVER_HOST}:${ADMIN_SERVER_PORT}/admin/api`

async function seedBaselineData(): Promise<number> {
    const now = new Date()
    const adminUser = {
        email: "admin@example.com",
        fullName: "Admin",
        isActive: 1,
        isSuperuser: 1,
        createdAt: now,
        updatedAt: now,
    }

    // Ensure we have an admin user; do NOT delete users to avoid FK issues
    await testKnex!(UsersTableName)
        .insert(adminUser)
        .onConflict("email")
        .merge(adminUser)

    const adminRow = await testKnex!(UsersTableName)
        .where({ email: adminUser.email })
        .first()
    const userId = adminRow?.id as number

    // Always recreate the API key since we can't retrieve the plaintext from
    // the DB.
    await testKnex!(AdminApiKeysTableName).where({ userId }).delete()
    const apiKey = createApiKey()
    const keyHash = hashApiKey(apiKey)
    await testKnex!(AdminApiKeysTableName).insert({
        userId,
        keyHash,
    })
    adminApiKey = apiKey

    return userId
}

export async function resetDbButKeepBaselines(): Promise<void> {
    // Clean all used tables except users and admin_api_keys (baseline), like
    // the previous monolithic test.
    await knexReadWriteTransaction(
        async (trx) => {
            const tables = TABLES_IN_USE.filter(
                (t) => t !== UsersTableName && t !== AdminApiKeysTableName
            )
            for (const table of tables) {
                await trx.raw(`DELETE FROM ??`, [table])
            }
        },
        TransactionCloseMode.KeepOpen,
        testKnex!
    )
}

export function getAdminTestEnv(): TestEnv {
    beforeAll(async () => {
        testKnex = knex(dbTestConfig)
        serverKnex = knex(dbTestConfig)
        await seedBaselineData()
        // Ensure we start from a clean slate for non-user tables
        await knexReadWriteTransaction(
            async (trx) => {
                const tables = TABLES_IN_USE.filter(
                    (t) => t !== UsersTableName && t !== AdminApiKeysTableName
                )
                for (const table of tables)
                    await trx.raw(`DELETE FROM ??`, [table])
            },
            TransactionCloseMode.KeepOpen,
            testKnex
        )
        setKnexInstance(serverKnex)

        app = new OwidAdminApp({ isDev: true, isTest: true, quiet: true })
        await app.startListening(ADMIN_SERVER_PORT, ADMIN_SERVER_HOST)
    })

    afterEach(async () => {
        await resetDbButKeepBaselines()
    })

    afterAll(async () => {
        await resetDbButKeepBaselines()
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
        method: "POST" | "PUT" | "DELETE"
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
        fetchJson,
        request,
        getCount,
    }
}
