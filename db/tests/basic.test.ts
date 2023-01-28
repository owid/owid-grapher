#! /usr/bin/env jest
import sqlFixtures from "sql-fixtures"
import { dbTestConfig } from "./dbTestConfig.js"
import { dataSource } from "./dataSource.dbtests.js"
import { Knex, knex } from "knex"
import { closeTypeOrmAndKnexConnections, getConnection } from "../db.js"
import * as typeorm from "typeorm"
import { User } from "../model/User.js"

let knexInstance: Knex<any, unknown[]> | undefined = undefined
let typeOrmConnection: typeorm.DataSource | undefined = undefined

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
    fixturesCreator.create(dataSpec, function (err: any, result: any) {
        if (err) console.error(err)
        // In case you want to see results of fixture creation you can do it like below
        // console.log(result.users[0].email)
    })
    typeOrmConnection = await getConnection(dataSource)
})

afterAll(async () => {
    // We leave the user in the database for other tests to use
    // For other cases it is good to drop any rows created in the test
    await typeOrmConnection?.destroy()
    await knexInstance?.destroy()
})

test("it can query a user created in fixture via TypeORM", async () => {
    if (!typeOrmConnection)
        throw new Error("TypeOrm connection not initialized")
    const user = await User.findOne({ where: { email: "admin@example.com" } })
    expect(user!.id).toBe(1)
    expect(user!.email).toBe("admin@example.com")
})
