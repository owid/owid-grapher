import knex, { type Knex } from "knex"
import { AdminApiKeysTableName, UsersTableName } from "@ourworldindata/types"
import { dbTestConfig } from "../../db/tests/dbTestConfig.js"
import {
    TransactionCloseMode,
    knexReadWriteTransaction,
    setKnexInstance,
} from "../../db/db.js"
import { TABLES_IN_USE } from "../../db/tests/testHelpers.js"
import { createApiKey, hashApiKey } from "../../serverUtils/apiKey.js"

export interface AdminTestDatabase {
    testKnex: Knex
    serverKnex: Knex
    apiKey: string
    userId: number
}

async function seedBaselineData(
    testKnex: Knex
): Promise<{ apiKey: string; userId: number }> {
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
    await testKnex(UsersTableName)
        .insert(adminUser)
        .onConflict("email")
        .merge(adminUser)

    const adminRow = await testKnex(UsersTableName)
        .where({ email: adminUser.email })
        .first()
    const userId = adminRow?.id as number

    // Always recreate the API key since we can't retrieve the plaintext from
    // the DB.
    await testKnex(AdminApiKeysTableName).where({ userId }).delete()
    const apiKey = createApiKey()
    const keyHash = hashApiKey(apiKey)
    await testKnex(AdminApiKeysTableName).insert({
        userId,
        keyHash,
    })

    return { apiKey, userId }
}

export async function resetDbButKeepBaselines(testKnex: Knex): Promise<void> {
    await knexReadWriteTransaction(
        async (trx) => {
            const tables = TABLES_IN_USE.filter(
                (table) =>
                    table !== UsersTableName && table !== AdminApiKeysTableName
            )
            for (const table of tables) {
                await trx.raw(`DELETE FROM ??`, [table])
            }
        },
        TransactionCloseMode.KeepOpen,
        testKnex
    )
}

export async function setupAdminTestDatabase(): Promise<AdminTestDatabase> {
    const testKnex = knex(dbTestConfig)
    const serverKnex = knex(dbTestConfig)
    const { apiKey, userId } = await seedBaselineData(testKnex)

    await resetDbButKeepBaselines(testKnex)
    setKnexInstance(serverKnex)

    return { testKnex, serverKnex, apiKey, userId }
}
