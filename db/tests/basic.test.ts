#! /usr/bin/env jest
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
import {
    ChartsTableName,
    DbInsertChart,
    DbPlainUser,
    DbRawChart,
    UsersTableName,
} from "@ourworldindata/types"
import { cleanTestDb, sleep } from "./testHelpers.js"

let knexInstance: Knex<any, unknown[]> | undefined = undefined

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
    knexInstance = knex(dbTestConfig)
    await cleanTestDb(knexInstance)

    for (const [tableName, tableData] of Object.entries(dataSpec)) {
        await knexInstance(tableName).insert(tableData)
    }
})

afterAll((done: any) => {
    // We leave the user in the database for other tests to use
    // For other cases it is good to drop any rows created in the test
    void Promise.allSettled([knexInstance?.destroy()]).then(() => done())
})

test("it can query a user created in fixture via TypeORM", async () => {
    expect(knexInstance).toBeDefined()
    const user = await knexInstance!
        .table(UsersTableName)
        .where({ email: "admin@example.com" })
        .first<DbPlainUser>()
    expect(user).toBeTruthy()
    expect(user.id).toBe(2)
    expect(user.email).toBe("admin@example.com")
})

test("timestamps are automatically created and updated", async () => {
    await knexReadWriteTransaction(
        async (trx) => {
            const chart: DbInsertChart = {
                config: "{}",
                lastEditedAt: new Date(),
                lastEditedByUserId: 2,
                is_indexable: 0,
            }
            await trx.table(ChartsTableName).insert(chart)
            const created = await knexRawFirst<DbRawChart>(
                trx,
                "select * from charts where id = 1",
                []
            )
            expect(created).not.toBeNull()
            if (created) {
                expect(created.createdAt).not.toBeNull()
                expect(created.updatedAt).toBeNull()
                await sleep(1000, undefined)
                await trx
                    .table(ChartsTableName)
                    .where({ id: 1 })
                    .update({ is_indexable: 1 })
                const updated = await knexRawFirst<DbRawChart>(
                    trx,
                    "select * from charts where id = 1",
                    []
                )
                expect(updated).not.toBeNull()
                if (updated) {
                    expect(updated.createdAt).not.toBeNull()
                    expect(updated.updatedAt).not.toBeNull()
                    expect(
                        updated.updatedAt!.getTime() -
                            updated.createdAt.getTime()
                    ).toBeGreaterThan(800)
                    expect(
                        updated.updatedAt!.getTime() -
                            updated.createdAt.getTime()
                    ).toBeLessThanOrEqual(2000)
                }
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
            await insertUser(trx, {
                email: "test@example.com",
                fullName: "Test User",
            })

            // Use the update helper method
            await updateUser(trx, 3, { isSuperuser: 1 })

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

            await deleteUser(trx, 3)
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
