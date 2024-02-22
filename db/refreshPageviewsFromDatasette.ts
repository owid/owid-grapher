// index.ts
import fetch from "node-fetch"
import Papa from "papaparse"
import * as db from "./db.js"
import { DbPlainAnalyticsPageview } from "@ourworldindata/types"
import { omitUndefinedValues } from "@ourworldindata/utils"

const analyticsPageviewsColumnNames: Array<keyof DbPlainAnalyticsPageview> = [
    "day",
    "url",
    "views_7d",
    "views_14d",
    "views_365d",
]

const emojiRegex =
    /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu

async function downloadAndInsertCSV(): Promise<void> {
    // Fetch CSV from private Datasette and insert it to a local MySQL. This function
    // exists because `make refresh` uses MySQL dump that excludes analytics_pageviews
    // table. That's why it's necessary to call `make refresh.pageviews` separately.
    const csvUrl =
        "http://datasette-private/owid/analytics_pageviews.csv?_size=max"
    const response = await fetch(csvUrl)

    if (!response.ok) {
        throw new Error(
            `Failed to fetch CSV: ${response.statusText} from ${csvUrl}`
        )
    }

    const csvText = await response.text()
    const parsedData = Papa.parse<Record<string, any>>(csvText, {
        header: true,
    })

    if (parsedData.errors.length > 1) {
        console.error("Errors while parsing CSV:", parsedData.errors)
        return
    }

    const table = [...parsedData.data].map((parsedRow) => {
        const row: Partial<DbPlainAnalyticsPageview> = {}
        for (const key of analyticsPageviewsColumnNames) {
            row[key] = parsedRow[key]
        }
        return omitUndefinedValues(row)
    })

    const onlyValidRows = table.filter(
        (row) =>
            row.day !== undefined &&
            row.url !== undefined &&
            // MySQL complains about emoji characters, so we filter them out
            !row.url.match(emojiRegex)
    )

    console.log("Parsed CSV data:", onlyValidRows.length, "rows")
    console.log("Columns:", analyticsPageviewsColumnNames.join(", "))

    // TODO: this instance should be handed down as a parameter
    const knex = db.knexInstance()

    await knex.transaction(async (trx) => {
        await db.knexRaw("TRUNCATE TABLE analytics_pageviews", trx)

        await trx.batchInsert("analytics_pageviews", onlyValidRows)
    })
    console.log("CSV data inserted successfully!")
}

const main = async (): Promise<void> => {
    try {
        await downloadAndInsertCSV()
    } catch (e) {
        console.error(e)
    } finally {
        await db.closeTypeOrmAndKnexConnections()
    }
}

main()
