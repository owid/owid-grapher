import type { Knex } from "knex"

export interface ColumnInfo {
    tableName: string
    columnName: string
    dataType: string
    columnType: string
    isNullable: boolean
    columnDefault: string | null
    extra: string
}

export type TsColumnType =
    | { kind: "boolean" | "number" | "string" | "Date" | "Buffer" }
    | { kind: "literals"; values: string[] }

/**
 * The JS type mysql2 returns for a column, given our connection options in
 * db/mysqlConnectionOptions.ts. driverTypes.test.ts checks these rules against
 * the real driver.
 */
export function tsTypeForColumn(
    column: Pick<ColumnInfo, "dataType" | "columnType">
): TsColumnType {
    const { dataType, columnType } = column
    // Our typeCast turns TINYINT(1) into booleans; other widths stay numbers
    if (columnType.startsWith("tinyint(1)")) return { kind: "boolean" }
    switch (dataType) {
        case "tinyint":
        case "smallint":
        case "mediumint":
        case "int":
        // BIGINTs come back as numbers and lose precision above 2^53
        case "bigint":
        case "float":
        case "double":
        case "year":
            return { kind: "number" }
        // DECIMALs come back as strings so they don't lose precision
        case "decimal":
        case "char":
        case "varchar":
        case "tinytext":
        case "text":
        case "mediumtext":
        case "longtext":
        case "time":
        case "set":
        // jsonStrings: true
        case "json":
            return { kind: "string" }
        case "enum":
            return { kind: "literals", values: parseEnumValues(columnType) }
        case "date":
        case "datetime":
        case "timestamp":
            return { kind: "Date" }
        case "binary":
        case "varbinary":
        case "tinyblob":
        case "blob":
        case "mediumblob":
        case "longblob":
        case "bit":
            return { kind: "Buffer" }
        default:
            throw new Error(
                `No TS type mapping for MySQL type "${columnType}"; add one to tsTypeForColumn`
            )
    }
}

function parseEnumValues(columnType: string): string[] {
    return [...columnType.matchAll(/'((?:[^']|'')*)'/g)].map((match) =>
        match[1].replaceAll("''", "'")
    )
}

/** Generated columns can't be written to */
export function isGeneratedColumn(column: Pick<ColumnInfo, "extra">): boolean {
    return / GENERATED$/.test(column.extra)
}

/** Columns MySQL fills in by itself when an insert leaves them out */
function isOptionalOnInsert(column: ColumnInfo): boolean {
    return (
        column.isNullable ||
        column.columnDefault !== null ||
        column.extra.includes("auto_increment") ||
        column.extra.includes("DEFAULT_GENERATED")
    )
}

export async function getColumns(
    knex: Knex,
    tableName?: string
): Promise<ColumnInfo[]> {
    const rows: {
        tableName: string
        columnName: string
        dataType: string
        columnType: string
        isNullable: string
        columnDefault: string | null
        extra: string
    }[] = await knex
        .select({
            tableName: "c.TABLE_NAME",
            columnName: "c.COLUMN_NAME",
            dataType: "c.DATA_TYPE",
            columnType: "c.COLUMN_TYPE",
            isNullable: "c.IS_NULLABLE",
            columnDefault: "c.COLUMN_DEFAULT",
            extra: "c.EXTRA",
        })
        .from("information_schema.COLUMNS as c")
        .join("information_schema.TABLES as t", function () {
            this.on("t.TABLE_SCHEMA", "c.TABLE_SCHEMA").andOn(
                "t.TABLE_NAME",
                "c.TABLE_NAME"
            )
        })
        .where("c.TABLE_SCHEMA", knex.raw("DATABASE()"))
        .andWhere("t.TABLE_TYPE", "BASE TABLE")
        .modify((query) => {
            if (tableName) query.andWhere("c.TABLE_NAME", tableName)
        })
        .orderBy([
            { column: "c.TABLE_NAME" },
            { column: "c.ORDINAL_POSITION" },
        ])
    return rows.map((row) => ({
        ...row,
        isNullable: row.isNullable === "YES",
    }))
}

function renderTsType(type: TsColumnType): string {
    return type.kind === "literals"
        ? type.values.map((value) => JSON.stringify(value)).join(" | ")
        : type.kind
}

function renderKey(name: string): string {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name)
}

/**
 * Renders the schema as one TS interface, with each table's row type (what a
 * SELECT returns) and insert type (what an INSERT accepts).
 */
export function renderSchemaTypes(columns: ColumnInfo[]): string {
    const tables = Map.groupBy(columns, (column) => column.tableName)
    const lines = [
        "// Generated from the db test database's schema by",
        "// db/tests/schemaTypes/schemaTypes.test.ts. Don't edit by hand; to",
        "// regenerate after a migration, run `make dbtest.update-schema-types`.",
        "// dbTypesMatchSchema.ts checks our DB type definitions against it.",
        "",
        "export interface DbSchema {",
    ]
    for (const [tableName, tableColumns] of tables) {
        lines.push(`    ${renderKey(tableName)}: {`)
        lines.push("        row: {")
        for (const column of tableColumns) {
            const type = renderTsType(tsTypeForColumn(column))
            const nullable = column.isNullable ? " | null" : ""
            lines.push(
                `            ${renderKey(column.columnName)}: ${type}${nullable}`
            )
        }
        lines.push("        }")
        lines.push("        insert: {")
        for (const column of tableColumns) {
            if (isGeneratedColumn(column)) continue
            const type = renderTsType(tsTypeForColumn(column))
            const nullable = column.isNullable ? " | null" : ""
            const optional = isOptionalOnInsert(column) ? "?" : ""
            lines.push(
                `            ${renderKey(column.columnName)}${optional}: ${type}${nullable}`
            )
        }
        lines.push("        }")
        lines.push("    }")
    }
    lines.push("}", "")
    return lines.join("\n")
}
