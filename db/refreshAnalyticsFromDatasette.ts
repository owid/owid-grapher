import Papa from "papaparse"
import * as db from "./db.js"
import { omitUndefinedValues } from "@ourworldindata/utils"
import {
    AnalyticsGrapherViewsTableName,
    AnalyticsPageviewsTableName,
} from "@ourworldindata/types"
import type {
    DbPlainAnalyticsGrapherView,
    DbPlainAnalyticsPageview,
} from "@ourworldindata/types"

const emojiRegex =
    /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu

interface TableConfig {
    tableName: string
    columns: string[]
    keyColumn: string
}

const analyticsPageviewsColumns: Array<keyof DbPlainAnalyticsPageview> = [
    "day",
    "url",
    "views_7d",
    "views_14d",
    "views_365d",
]

const analyticsPageviewsKeyColumn: keyof DbPlainAnalyticsPageview = "url"

const analyticsGrapherViewsColumns: Array<keyof DbPlainAnalyticsGrapherView> = [
    "day",
    "grapher_slug",
    "views_7d",
    "views_14d",
    "views_365d",
]

const analyticsGrapherViewsKeyColumn: keyof DbPlainAnalyticsGrapherView =
    "grapher_slug"

const tables: TableConfig[] = [
    {
        tableName: AnalyticsPageviewsTableName,
        columns: analyticsPageviewsColumns,
        keyColumn: analyticsPageviewsKeyColumn,
    },
    {
        tableName: AnalyticsGrapherViewsTableName,
        columns: analyticsGrapherViewsColumns,
        keyColumn: analyticsGrapherViewsKeyColumn,
    },
]

async function refreshTable(
    knex: db.KnexReadWriteTransaction,
    config: TableConfig
): Promise<void> {
    const { tableName, columns, keyColumn } = config
    console.log(`\n==> Refreshing ${tableName}`)

    const csvUrl = `http://analytics/private/${tableName}.csv?_stream=on&_size=max`
    const response = await fetch(csvUrl)

    if (!response.ok) {
        throw new Error(
            `Failed to fetch CSV: ${response.statusText} from ${csvUrl}`
        )
    }

    const csvText = await response.text()
    const parsedData = Papa.parse<Record<string, string>>(csvText, {
        header: true,
    })

    if (parsedData.errors.length > 1) {
        console.error("Errors while parsing CSV:", parsedData.errors)
        return
    }

    const rows = parsedData.data
        .map((parsedRow) => {
            const row: Record<string, string | undefined> = {}
            for (const col of columns) {
                row[col] = parsedRow[col]
            }
            return omitUndefinedValues(row)
        })
        .filter(
            (row) =>
                row.day !== undefined &&
                row[keyColumn] !== undefined &&
                // MySQL complains about emoji characters, so we filter them out
                !row[keyColumn].match(emojiRegex)
        )

    console.log("Parsed CSV data:", rows.length, "rows")

    await db.knexRaw(knex, `TRUNCATE TABLE ${tableName}`)
    await knex.transaction(async (trx) => {
        await trx.batchInsert(tableName, rows)
    })
    console.log(`${tableName} data inserted successfully!`)
}

async function refreshAllAnalytics(
    knex: db.KnexReadWriteTransaction
): Promise<void> {
    // Fetch CSV from private Datasette and insert it to a local MySQL. This function
    // exists because `make refresh` uses MySQL dump that excludes analytics tables.
    // That's why it's necessary to call `make refresh.analytics` separately.
    for (const table of tables) {
        await refreshTable(knex, table)
    }
}

const main = async (): Promise<void> => {
    try {
        await db.knexReadWriteTransaction(
            (trx) => refreshAllAnalytics(trx),
            db.TransactionCloseMode.Close
        )
    } catch (e) {
        console.error(e)
    }
}

void main()
