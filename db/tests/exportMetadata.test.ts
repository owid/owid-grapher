import { expect, beforeAll, test, afterAll } from "vitest"

import knex, { Knex } from "knex"
import { dbTestConfig } from "./dbTestConfig.js"
import {
    PUBLIC_DATA_TABLES,
    PRIVATE_DATA_TABLES,
    findUnclassifiedTables,
    unclassifiedTablesErrorMessage,
} from "../exportMetadataTables.js"

let knexInstance: Knex<any, unknown[]> | undefined = undefined

beforeAll(() => {
    knexInstance = knex(dbTestConfig)
})

afterAll(async () => {
    await knexInstance?.destroy()
})

// The test database has all migrations applied, so this catches a migration
// that adds a table without classifying it in db/exportMetadataTables.ts —
// otherwise the nightly metadata export (exportMetadata.ts) fails in
// production instead.
test("every table created by migrations is classified for the metadata export", async () => {
    const rows: { TABLE_NAME: string }[] = await knexInstance!
        .select("TABLE_NAME")
        .from("information_schema.TABLES")
        .where("TABLE_SCHEMA", knexInstance!.raw("DATABASE()"))
        .andWhere("TABLE_TYPE", "BASE TABLE")

    // _test_db_ready is a marker table created by the test database bootstrap
    // (devTools/docker/create-test-db.sh); it never exists in production.
    const allTables = rows
        .map((r) => r.TABLE_NAME)
        .filter((t) => t !== "_test_db_ready")
    // Sanity check that we're looking at a migrated database
    expect(allTables).toContain("charts")

    const unclassified = findUnclassifiedTables(allTables)
    expect(unclassified, unclassifiedTablesErrorMessage(unclassified)).toEqual(
        []
    )
})

// admin_api_keys holds hashed authentication material. It must never ship in
// the public owid_metadata dump — only in the private sidecar (see
// db/exportPrivateData.ts). This guards against someone moving it back into
// PUBLIC_DATA_TABLES.
test("admin_api_keys data is private, never in the public dump", () => {
    expect(PUBLIC_DATA_TABLES).not.toContain("admin_api_keys")
    expect(PRIVATE_DATA_TABLES).toContain("admin_api_keys")
})
