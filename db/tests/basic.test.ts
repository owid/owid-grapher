#! /usr/bin/env jest
import sqlFixtures from "sql-fixtures"
import { dbTestConfig } from "./dbTestConfig.js"
import { dataSource } from "./dataSource.dbtests.js"
import { Knex, knex } from "knex"
import { getConnection } from "../db.js"
import * as typeorm from "typeorm"
import { User } from "../model/User.js"
import * as fs from "fs-extra"
import { createGunzip } from "zlib"
import getStream from "get-stream"
import { Chart } from "../model/Chart.js"

let knexInstance: Knex<any, unknown[]> | undefined = undefined
let typeOrmConnection: typeorm.DataSource | undefined = undefined

async function readGzippedFile(filename: string): Promise<string> {
    const readStream = fs.createReadStream(filename)

    const gzipStream = createGunzip()
    readStream.pipe(gzipStream)
    const content = await getStream(gzipStream)
    return content
}

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
        ].concat(
            // These 99 dummy users are there so that FK constraints with imported
            // data will not fail. We don't usually care about the actual users
            // but having 100 users makes sure that we don't have to rewrite
            // bulk exported test data before import
            [...Array(99).keys()].map((num) => ({
                email: `user${num}@example.com`,
                fullName: "User",
                password: "user",
                createdAt: new Date(),
                updatedAt: new Date(),
            }))
        ),
    }
    knexInstance = knex(dbTestConfig)

    const fixturesCreator = new sqlFixtures(knexInstance)
    await fixturesCreator.create(dataSpec, function (err: any, result: any) {
        if (err) console.error(err)
        // In case you want to see results of fixture creation you can do it like below
        // console.log(result.users[0].email)
    })
    typeOrmConnection = await getConnection(dataSource)

    // read the gzipped sql file and insert it into the database
    const sql = await readGzippedFile("db/tests/allcharts.sql.gz")
    await knexInstance.raw(sql)
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

test("it can run tests on many charts", async () => {
    const chartsCount = await Chart.count()
    expect(chartsCount).toBeGreaterThan(2000)
    expect(chartsCount).toBeLessThan(10000)

    const charts = await Chart.find()
    // This is a dummy test but it shows that we could test more complex properties here
    for (const chart of charts) expect(chart.config.title).toBeTruthy()
})
