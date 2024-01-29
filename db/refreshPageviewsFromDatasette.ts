// index.ts
import fetch from "node-fetch"
import Papa from "papaparse"
import * as db from "./db.js"

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
    const parsedData = Papa.parse(csvText, {
        header: true,
    })

    if (parsedData.errors.length > 1) {
        console.error("Errors while parsing CSV:", parsedData.errors)
        return
    }

    const onlyValidRows = [...parsedData.data].filter(
        (row) => Object.keys(row as any).length === 5
    ) as any[]

    console.log("Parsed CSV data:", onlyValidRows.length, "rows")
    console.log("Columns:", parsedData.meta.fields)

    // TODO: this instance should be handed down as a parameter
    const knex = db.knexInstance()

    knex.transaction(async (trx) => {
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
