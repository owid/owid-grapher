/**
 * mysql2 connection options that decide which JS types query results come back
 * as. Shared by the app's knex instance and the db tests, so the tests read
 * values the same way production does.
 *
 * The DB schema type check (db/tests/schemaTypes/) assumes these options; if you
 * change them, update `tsTypeForColumn` in db/tests/schemaTypes/renderSchemaTypes.ts.
 */
export const mysqlTypeOptions = {
    typeCast: (field: any, next: any) => {
        if (field.type === "TINY" && field.length === 1) {
            return field.string() === "1" // 1 = true, 0 = false
        }

        return next()
    },

    // The mysql2 driver will return JSON objects by default, which is nice, but we have many code paths that
    // expect JSON strings, so we instead tell it to return JSON strings.
    jsonStrings: true,
}
