import { afterAll, beforeAll, expect, test } from "vitest"
import knex, { Knex } from "knex"
import { dbTestConfig } from "../dbTestConfig.js"
import { getColumns, TsColumnType, tsTypeForColumn } from "./renderSchemaTypes.js"

// The schema type check is only as good as tsTypeForColumn's rules, so this
// reads one value of every MySQL type we map through the real driver and
// connection options and checks it has the type the rules claim.

const PROBE_TABLE = "schema_types_driver_probe"

const PROBE_COLUMNS: Record<string, { definition: string; value: unknown }> =
    {
        tinyint1Col: { definition: "TINYINT(1)", value: 1 },
        tinyintCol: { definition: "TINYINT", value: 1 },
        smallintCol: { definition: "SMALLINT", value: 1 },
        mediumintCol: { definition: "MEDIUMINT", value: 1 },
        intCol: { definition: "INT", value: 1 },
        intUnsignedCol: { definition: "INT UNSIGNED", value: 1 },
        bigintCol: { definition: "BIGINT", value: 1792566490350 },
        bigintUnsignedCol: { definition: "BIGINT UNSIGNED", value: 1 },
        floatCol: { definition: "FLOAT", value: 1.5 },
        doubleCol: { definition: "DOUBLE", value: 1.5 },
        yearCol: { definition: "YEAR", value: 2026 },
        decimalCol: { definition: "DECIMAL(10, 2)", value: "1.50" },
        charCol: { definition: "CHAR(4)", value: "abcd" },
        varcharCol: { definition: "VARCHAR(255)", value: "abc" },
        tinytextCol: { definition: "TINYTEXT", value: "abc" },
        textCol: { definition: "TEXT", value: "abc" },
        mediumtextCol: { definition: "MEDIUMTEXT", value: "abc" },
        longtextCol: { definition: "LONGTEXT", value: "abc" },
        timeCol: { definition: "TIME", value: "12:34:56" },
        setCol: { definition: "SET('a', 'b')", value: "a,b" },
        jsonCol: { definition: "JSON", value: '{"a": 1}' },
        enumCol: { definition: "ENUM('a', 'b')", value: "b" },
        dateCol: { definition: "DATE", value: "2026-10-21" },
        datetimeCol: { definition: "DATETIME", value: "2026-10-21 12:34:56" },
        timestampCol: { definition: "TIMESTAMP", value: "2026-10-21 12:34:56" },
        binaryCol: { definition: "BINARY(2)", value: Buffer.from("ab") },
        varbinaryCol: { definition: "VARBINARY(16)", value: Buffer.from("ab") },
        tinyblobCol: { definition: "TINYBLOB", value: Buffer.from("ab") },
        blobCol: { definition: "BLOB", value: Buffer.from("ab") },
        mediumblobCol: { definition: "MEDIUMBLOB", value: Buffer.from("ab") },
        longblobCol: { definition: "LONGBLOB", value: Buffer.from("ab") },
        bitCol: { definition: "BIT(1)", value: 1 },
        nullableIntCol: { definition: "INT NULL", value: null },
    }

let knexInstance: Knex

beforeAll(async () => {
    knexInstance = knex(dbTestConfig)
    const definitions = Object.entries(PROBE_COLUMNS).map(
        ([name, { definition }]) => `${name} ${definition}`
    )
    await knexInstance.raw(`DROP TABLE IF EXISTS ${PROBE_TABLE}`)
    await knexInstance.raw(
        `CREATE TABLE ${PROBE_TABLE} (${definitions.join(", ")})`
    )
    await knexInstance(PROBE_TABLE).insert(
        Object.fromEntries(
            Object.entries(PROBE_COLUMNS).map(([name, { value }]) => [
                name,
                value,
            ])
        )
    )
})

afterAll(async () => {
    // Dropped so it doesn't end up in dbSchema.generated.ts
    await knexInstance.raw(`DROP TABLE IF EXISTS ${PROBE_TABLE}`)
    await knexInstance.destroy()
})

function matchesTsType(value: unknown, type: TsColumnType): boolean {
    switch (type.kind) {
        case "boolean":
        case "number":
        case "string":
            return typeof value === type.kind
        case "Date":
            return value instanceof Date
        case "Buffer":
            return Buffer.isBuffer(value)
        case "literals":
            return typeof value === "string" && type.values.includes(value)
    }
}

test("tsTypeForColumn matches what the driver returns for every column type", async () => {
    const columns = await getColumns(knexInstance, PROBE_TABLE)
    expect(columns.map((column) => column.columnName)).toEqual(
        Object.keys(PROBE_COLUMNS)
    )
    const row = await knexInstance(PROBE_TABLE).first()

    const mismatches = columns
        .filter((column) => row[column.columnName] !== null)
        .map((column) => ({
            column: column.columnType,
            claimed: tsTypeForColumn(column),
            value: row[column.columnName],
        }))
        .filter(({ claimed, value }) => !matchesTsType(value, claimed))
        .map(({ column, claimed, value }) => ({
            column,
            claimed: claimed.kind,
            actual: value?.constructor?.name ?? typeof value,
        }))
    expect(mismatches).toEqual([])
})

test("nullable columns come back as null", async () => {
    const row = await knexInstance(PROBE_TABLE).first()
    expect(row.nullableIntCol).toBeNull()
})
