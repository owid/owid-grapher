#! /usr/bin/env jest
import sqlFixtures from "sql-fixtures"
import { dbTestConfig } from "./dbTestConfig.js"
import { dataSource } from "./dataSource.dbtests.js"
import { Knex, knex } from "knex"
import { getConnection } from "../db.js"
import * as typeorm from "typeorm"
import { User } from "../model/User.js"
import { Chart } from "../model/Chart.js"
import md5 from "md5"

let knexInstance: Knex<any, unknown[]> | undefined = undefined
let typeOrmConnection: typeorm.DataSource | undefined = undefined

beforeAll(async () => {
    knexInstance = knex(dbTestConfig)

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

test("manual bulk redirects virtual properties and helper functions works", async () => {
    const targetUrl = "/:splat"
    knexInstance!
        .raw(`insert into manual_bulk_redirects (slug, targetDomain, targetPath, targetQuery, targetFragment, statusCode)
    values (
        '/entries/*',
        extract_url_domain('${targetUrl}'),
        extract_url_path('${targetUrl}'),
        extract_url_query('${targetUrl}'),
        extract_url_fragment('${targetUrl}'),
        302
    )`)
    const rows = knexInstance!.raw(`-- sql
        select * from manual_bulk_redirects
        `)
    expect(rows.length).toBe(1)
    expect(rows[0]).toMatchObject({
        id: 1,
        slug: "/entries/*",
        targetDomain: "",
        targetPath: "/:splat",
        targetQuery: "",
        targetFragment: "",
        statusCode: 302,
        targetLocation: "/:splat",
        targetUrl: "/:splat",
        slugMd5: md5("/entries/*"),
        targetUrlMd5: md5("/:splat"),
        targetLocationMd5: md5("/:splat"),
    })

    // TODO; check that insert into all redirectable and complete slugs worked
    // TODO: check that unique constrain works
    // TODO: check another row where query and fragment are tested
})
