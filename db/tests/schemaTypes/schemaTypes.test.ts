import { afterAll, beforeAll, expect, test } from "vitest"
import knex, { Knex } from "knex"
import { dbTestConfig } from "../dbTestConfig.js"
import { getColumns, renderSchemaTypes } from "./renderSchemaTypes.js"

let knexInstance: Knex

beforeAll(() => {
    knexInstance = knex(dbTestConfig)
})

afterAll(async () => {
    await knexInstance.destroy()
})

// dbSchema.generated.ts must match the schema after all migrations, so that
// typechecking dbTypesMatchSchema.ts compares our DB types against the real
// schema. When this fails after a migration, run
// `make dbtest.update-schema-types` and commit the result.
test("dbSchema.generated.ts is up to date with the migrated schema", async () => {
    const columns = await getColumns(knexInstance)
    await expect(renderSchemaTypes(columns)).toMatchFileSnapshot(
        "./dbSchema.generated.ts"
    )
})
