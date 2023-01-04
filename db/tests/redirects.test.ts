#! /usr/bin/env jest
import sqlFixtures from "sql-fixtures"
import { dbTestConfig } from "./dbTestConfig.js"
import { Knex, knex } from "knex"

let knexInstance: Knex<any, unknown[]> | undefined = undefined

beforeAll(() => {
    const dataSpec = {
        manual_bulk_redirects: {
            slug: "/test/*",
            targetPath: "/redirected-test/:slug",
            statusCode: 301,
        },
    }
    knexInstance = knex(dbTestConfig)

    const fixturesCreator = new sqlFixtures(knexInstance)
    fixturesCreator.create(dataSpec, function (err: any, result: any) {
        // at this point a row has been added to the users table
        console.log(result.manual_bulk_redirects[0].slug)
    })
})

afterAll(() => {})

interface ManualBulkRedirect {
    id: number
    slug: string
    targetPath: string
    statusCode: number
}

test("it can query a manual bulk redirect", async () => {
    if (!knexInstance) throw new Error("Knex instance not initialized")
    const manual_bulk_redirects = knexInstance<ManualBulkRedirect>(
        "manual_bulk_redirects"
    )
    const firstRow = await manual_bulk_redirects.select().where("id", 1).first()
    expect(firstRow!.id).toBe(1)
})
