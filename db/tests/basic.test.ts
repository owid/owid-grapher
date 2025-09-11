import { expect, beforeAll, test, afterAll } from "vitest"

import { dbTestConfig } from "./dbTestConfig.js"
import { knex, Knex } from "knex"
import {
    knexRaw,
    knexReadWriteTransaction,
    KnexReadonlyTransaction,
    KnexReadWriteTransaction,
    knexRawFirst,
    knexReadonlyTransaction,
    TransactionCloseMode,
} from "../db.js"
import { deleteUser, insertUser, updateUser } from "../model/User.js"
import { uuidv7 } from "uuidv7"
import {
    ChartsTableName,
    ChartConfigsTableName,
    DbInsertChart,
    DbPlainUser,
    DbPlainChart,
    UsersTableName,
    DbInsertChartConfig,
    DatasetsTableName,
    VariablesTableName,
    ChartDimensionsTableName,
} from "@ourworldindata/types"
import { cleanTestDb } from "./testHelpers.js"
import { checkDatasetVariablesInUse } from "../model/Dataset.js"

let knexInstance: Knex<any, unknown[]> | undefined = undefined

beforeAll(async () => {
    const dataSpec = {
        users: [
            {
                id: 1,
                email: "admin@example.com",
                fullName: "Admin",
                password: "admin",
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ],
    }
    knexInstance = knex(dbTestConfig)
    // Clean the database so that the tests can start with a clean slate
    await cleanTestDb(knexInstance)

    for (const [tableName, tableData] of Object.entries(dataSpec)) {
        await knexInstance(tableName).insert(tableData)
    }
})

afterAll(async () => {
    // We leave the user in the database for other tests to use
    // For other cases it is good to drop any rows created in the test
    await Promise.allSettled([knexInstance?.destroy()])
})

test("it can query a user created in fixture via TypeORM", async () => {
    expect(knexInstance).toBeDefined()
    const user = await knexInstance!
        .table(UsersTableName)
        .where({ email: "admin@example.com" })
        .first<DbPlainUser>()
    expect(user).toBeTruthy()
    expect(user.email).toBe("admin@example.com")
})

test("createdAt timestamp is automatically created", async () => {
    await knexReadWriteTransaction(
        async (trx) => {
            const user = await knexInstance!
                .table(UsersTableName)
                .where({ email: "admin@example.com" })
                .first<DbPlainUser>()
            expect(user).toBeTruthy()
            expect(user.email).toBe("admin@example.com")
            const configId = uuidv7()
            const chartConfig: DbInsertChartConfig = {
                id: configId,
                patch: "{}",
                full: "{}",
            }
            const chart: DbInsertChart = {
                configId,
                lastEditedAt: new Date(),
                lastEditedByUserId: user.id,
                isIndexable: false,
            }
            await trx.table(ChartConfigsTableName).insert(chartConfig)
            const res = await trx.table(ChartsTableName).insert(chart)
            const chartId = res[0]
            const created = await knexRawFirst<DbPlainChart>(
                trx,
                "select * from charts where id = ?",
                [chartId]
            )
            expect(created).not.toBeNull()
            if (created) {
                expect(created.createdAt).not.toBeNull()
                expect(created.updatedAt).toBeNull()
            }
        },
        TransactionCloseMode.KeepOpen,
        knexInstance
    )
})

test("knex interface", async () => {
    if (!knexInstance) throw new Error("Knex connection not initialized")

    // Create a transaction and run all tests inside it
    await knexReadWriteTransaction(
        async (trx) => {
            // Fetch all users into memory
            const users = await trx
                .from<DbPlainUser>(UsersTableName)
                .select("isSuperuser", "email")
            expect(users.length).toBe(1)

            // Fetch all users in a streaming fashion, iterate over them async to avoid having to load everything into memory
            const usersStream = trx
                .from<DbPlainUser>(UsersTableName)
                .select("isSuperuser", "email")
                .stream()

            for await (const user of usersStream) {
                expect(user.isSuperuser).toBe(0)
                expect(user.email).toBe("admin@example.com")
            }

            // Use the insert helper method
            const userIds = await insertUser(trx, {
                email: "test@example.com",
                fullName: "Test User",
            })

            const userId = userIds[0]
            expect(userId).toBeGreaterThan(0)

            // Use the update helper method
            await updateUser(trx, userId, { isSuperuser: 1 })

            // Check results after update and insert
            const afterUpdate = await trx
                .from<DbPlainUser>(UsersTableName)
                .select("isSuperuser", "email")
                .orderBy("id")
            expect(afterUpdate.length).toBe(2)
            expect(afterUpdate[1].isSuperuser).toBe(1)

            // The pick type is used to type the result row
            const usersFromRawQuery: Pick<DbPlainUser, "email">[] =
                await knexRaw(trx, "select email from users", [])
            expect(usersFromRawQuery.length).toBe(2)

            // Check if in queries work as expected
            const usersFromRawQueryWithInClauseAsObj: Pick<
                DbPlainUser,
                "email"
            >[] = await knexRaw(
                trx,
                "select * from users where email in (:emails)",
                {
                    emails: [
                        usersFromRawQuery[0].email,
                        usersFromRawQuery[1].email,
                    ],
                }
            )
            expect(usersFromRawQueryWithInClauseAsObj.length).toBe(2)

            const usersFromRawQueryWithInClauseAsArray: Pick<
                DbPlainUser,
                "email"
            >[] = await knexRaw(trx, "select * from users where email in (?)", [
                [usersFromRawQuery[0].email, usersFromRawQuery[1].email],
            ])
            expect(usersFromRawQueryWithInClauseAsArray.length).toBe(2)

            await deleteUser(trx, userId)
        },
        TransactionCloseMode.KeepOpen,
        knexInstance
    )
})

export async function testRo(
    trx: KnexReadonlyTransaction
): Promise<{ result: number }[]> {
    return knexRaw<{ result: number }>(trx, "SELECT 1 + 1 as result")
}

export async function testGetNumUsers(
    trx: KnexReadonlyTransaction
): Promise<{ userCount: number }[]> {
    return knexRaw<{ userCount: number }>(
        trx,
        "SELECT count(*) as userCount from users"
    )
}

export async function testRw(trx: KnexReadWriteTransaction): Promise<void> {
    await knexRaw(trx, "INSERT INTO users (email, fullName) VALUES (?, ?)", [
        "test2@ourworldindata.org",
        "Test User 2",
    ])
}
test("Transaction setup", async () => {
    const result = await knexReadWriteTransaction(
        async (trx) => {
            const result = await testRo(trx)
            expect(result.length).toBe(1)
            expect(result[0].result).toBe(2)
            await testRw(trx)
            return await testGetNumUsers(trx)
        },
        TransactionCloseMode.KeepOpen,
        knexInstance
    )
    expect(result.length).toBe(1)
    expect(result[0].userCount).toBe(2)
})

test("Write actions in read-only transactions fail", async () => {
    await expect(async () => {
        return knexReadonlyTransaction(
            async (trx) => {
                await testRw(trx as KnexReadWriteTransaction) // The cast is necessary to not make TypeScript complain and catch this error :)
            },
            TransactionCloseMode.KeepOpen,
            knexInstance
        )
    }).rejects.toThrow()
})

test("checkDatasetVariablesInUse returns false when no variables exist", async () => {
    if (!knexInstance) throw new Error("Database not initialized")
    const result = await knexReadWriteTransaction(
        async (trx) => {
            // Create a dataset with no variables
            const datasetId = await trx(DatasetsTableName)
                .insert({
                    name: "Test",
                    namespace: "test",
                    description: "A test",
                    isPrivate: false,
                    isArchived: false,
                    nonRedistributable: false,
                    createdByUserId: 1,
                    metadataEditedByUserId: 1,
                    dataEditedByUserId: 1,
                    metadataEditedAt: new Date(),
                    dataEditedAt: new Date(),
                })
                .then((res) => res[0])

            return checkDatasetVariablesInUse(trx, datasetId)
        },
        TransactionCloseMode.KeepOpen,
        knexInstance
    )

    expect(result.inUse).toBe(false)
    expect(result.usageDetails).toEqual({
        chartsCount: 0,
        explorersCount: 0,
        multiDimCount: 0,
    })
})

test("checkDatasetVariablesInUse returns true when variables are used in charts", async () => {
    if (!knexInstance) throw new Error("Database not initialized")

    const result = await knexReadWriteTransaction(
        async (trx) => {
            const user = await trx(UsersTableName).first()
            const userId = user!.id
            // Create a dataset
            const datasetId = await trx(DatasetsTableName)
                .insert({
                    name: "Test",
                    namespace: "test",
                    description: "A test",
                    isPrivate: false,
                    isArchived: false,
                    nonRedistributable: false,
                    createdByUserId: userId,
                    metadataEditedByUserId: userId,
                    dataEditedByUserId: userId,
                    metadataEditedAt: new Date(),
                    dataEditedAt: new Date(),
                })
                .then((res) => res[0])

            console.log("datasetId", datasetId)

            // Create a variable in that dataset
            const variableId = await trx(VariablesTableName)
                .insert({
                    name: "Test Variable",
                    unit: "units",
                    description: "A test variable",
                    coverage: "Global",
                    timespan: "2000-2020",
                    datasetId,
                    display: JSON.stringify({}),
                })
                .then((res) => res[0])

            // Create a chart that uses this variable
            const configId = uuidv7()
            await trx(ChartConfigsTableName).insert({
                id: configId,
                patch: "{}",
                full: "{}",
            })
            const chartId = await trx(ChartsTableName)
                .insert({
                    configId,
                    lastEditedAt: new Date(),
                    lastEditedByUserId: 1,
                })
                .then((res) => res[0])

            // Link the chart to the variable
            await trx(ChartDimensionsTableName).insert({
                chartId,
                variableId,
                property: "y",
                order: 0,
            })

            return checkDatasetVariablesInUse(trx, datasetId)
        },
        TransactionCloseMode.KeepOpen,
        knexInstance
    )

    expect(result.inUse).toBe(true)
    expect(result.usageDetails.chartsCount).toBe(1)
    expect(result.usageDetails.explorersCount).toBe(0)
    expect(result.usageDetails.multiDimCount).toBe(0)
})
