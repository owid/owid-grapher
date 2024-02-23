#! /usr/bin/env jest
import sqlFixtures from "sql-fixtures"
import { dbTestConfig } from "./dbTestConfig.js"
import { dataSource } from "./dataSource.dbtests.js"
import { knex, Knex } from "knex"
import { getConnection, knexRaw } from "../db.js"
import { DataSource } from "typeorm"
import { insertUser, updateUser, User } from "../model/User.js"
import { Chart } from "../model/Chart.js"
import { DbPlainUser, UsersTableName } from "@ourworldindata/types"

let knexInstance: Knex<any, unknown[]> | undefined = undefined
let typeOrmConnection: DataSource | undefined = undefined

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

    const fixturesCreator = new sqlFixtures(knexInstance)
    fixturesCreator.create(dataSpec, function (err: any, _: any) {
        if (err) console.error(err)
        // In case you want to see results of fixture creation you can do it like below
        // console.log(_.users[0].email)
    })
    typeOrmConnection = await getConnection(dataSource)
})

afterAll((done: any) => {
    // We leave the user in the database for other tests to use
    // For other cases it is good to drop any rows created in the test
    Promise.allSettled([
        typeOrmConnection?.destroy(),
        knexInstance?.destroy(),
    ]).then(() => done())
})

test("it can query a user created in fixture via TypeORM", async () => {
    if (!typeOrmConnection)
        throw new Error("TypeOrm connection not initialized")
    const user = await User.findOne({ where: { email: "admin@example.com" } })
    expect(user!.id).toBe(1)
    expect(user!.email).toBe("admin@example.com")
})

function sleep(time: number, value: any): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(() => {
            return resolve(value)
        }, time)
    })
}

test("timestamps are automatically created and updated", async () => {
    const chart = new Chart()
    chart.config = {}
    chart.lastEditedAt = new Date()
    chart.lastEditedByUserId = 1
    chart.isExplorable = true
    await chart.save()
    const created: Chart | null = await Chart.findOne({ where: { id: 1 } })
    expect(created).not.toBeNull()
    if (created) {
        expect(created.createdAt).not.toBeNull()
        expect(created.updatedAt).toBeNull()
        await sleep(1000, undefined)
        created.isExplorable = false
        await created.save()
        const updated: Chart | null = await Chart.findOne({ where: { id: 1 } })
        expect(updated).not.toBeNull()
        if (updated) {
            expect(updated.createdAt).not.toBeNull()
            expect(updated.updatedAt).not.toBeNull()
            expect(
                updated.updatedAt.getTime() - updated.createdAt.getTime()
            ).toBeGreaterThan(800)
            expect(
                updated.updatedAt.getTime() - updated.createdAt.getTime()
            ).toBeLessThanOrEqual(2000)
        }
    }
})

test("knex interface", async () => {
    if (!knexInstance) throw new Error("Knex connection not initialized")

    // Create a transaction and run all tests inside it
    await knexInstance.transaction(async (trx) => {
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
        await updateUser(trx, 2, { isSuperuser: 1 })

        // Check results after update and insert
        const afterUpdate = await trx
            .from<DbPlainUser>(UsersTableName)
            .select("isSuperuser", "email")
            .orderBy("id")
        expect(afterUpdate.length).toBe(2)
        expect(afterUpdate[1].isSuperuser).toBe(1)

        // Use raw queries, using ?? to specify the table name using the shared const value
        // The pick type is used to type the result row
        const usersFromRawQuery: Pick<DbPlainUser, "email">[] = await knexRaw(
            "select email from ??",
            trx,
            [UsersTableName]
        )
        expect(usersFromRawQuery.length).toBe(2)
    })
})

test("knex interface raw", async () => {
    if (!knexInstance) throw new Error("Knex connection not initialized")

    // Create a transaction and run all tests inside it
    await knexInstance.transaction(async (trx) => {
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
        await updateUser(trx, 2, { isSuperuser: 1 })

        // Check results after update and insert
        const afterUpdate = await trx
            .from<DbPlainUser>(UsersTableName)
            .select("isSuperuser", "email")
            .orderBy("id")
        expect(afterUpdate.length).toBe(2)
        expect(afterUpdate[1].isSuperuser).toBe(1)

        // Use raw queries, using ?? to specify the table name using the shared const value
        // The pick type is used to type the result row
        const usersFromRawQuery: Pick<DbPlainUser, "email">[] = await knexRaw(
            "select email from ??",
            trx,
            [UsersTableName]
        )
        expect(usersFromRawQuery.length).toBe(2)
    })
})
