#!/usr/bin/env tsx

import { dataSource } from "../../db/dataSource.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"

async function main() {
    const argv = yargs(hideBin(process.argv))
        .command(
            "$0 <sql>",
            "Execute SQL query against the database",
            (yargs) => {
                yargs.positional("sql", {
                    describe: "SQL query to execute",
                    type: "string",
                    demandOption: true,
                })
            }
        )
        .example("$0 'SELECT * FROM users LIMIT 10'", "Basic query")
        .example(
            "$0 \"SELECT content->>'$.title' FROM posts_gdocs LIMIT 1\"",
            "JSON path query"
        )
        .help()
        .alias("h", "help")
        .parseSync()

    const sql = argv.sql as string

    if (!sql) {
        console.error("Error: SQL query is required")
        process.exit(1)
    }

    try {
        // Initialize the database connection
        await dataSource.initialize()

        console.log(`Executing query: ${sql}`)
        console.log("---")

        // Execute the raw SQL query
        const result = await dataSource.query(sql)

        if (Array.isArray(result) && result.length > 0) {
            // If we have results, display them in a table format
            console.table(result)
        } else {
            console.log("Query executed successfully. No results returned.")
        }
    } catch (error) {
        console.error("Error executing query:", error)
        process.exit(1)
    } finally {
        // Close the database connection
        if (dataSource.isInitialized) {
            await dataSource.destroy()
        }
    }
}

main().catch((error) => {
    console.error("Unexpected error:", error)
    process.exit(1)
})
