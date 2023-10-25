// index.ts
import fetch from "node-fetch"
import Papa from "papaparse"
import * as db from "./db.js"

async function downloadAndInsertCSV(): Promise<void> {
    const csvUrl = "http://datasette-private/owid/pageviews.csv?_size=max"
    const response = await fetch(csvUrl)

    if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.statusText}`)
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

    await db.knexRaw("TRUNCATE TABLE pageviews")

    await db.knexInstance().batchInsert("pageviews", onlyValidRows)
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
