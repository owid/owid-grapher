#!/usr/bin/env tsx

/**
 * Export a Google Doc post as XHTML.
 *
 * Usage:
 *   yarn tsx devTools/gdocs/export-xhtml.ts <slug>
 *
 * Example:
 *   yarn tsx devTools/gdocs/export-xhtml.ts poverty
 */

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { dataSource } from "../../db/dataSource.js"
import { enrichedBlocksToXhtmlDocument } from "../../db/model/Gdoc/enrichedToXhtml.js"
import { OwidGdocContent } from "@ourworldindata/types"

async function main() {
    const argv = yargs(hideBin(process.argv))
        .command("$0 <slug>", "Export a Google Doc post as XHTML", (yargs) => {
            yargs.positional("slug", {
                describe: "The slug of the post to export",
                type: "string",
                demandOption: true,
            })
        })
        .option("pretty", {
            alias: "p",
            type: "boolean",
            description: "Pretty print the XHTML output",
            default: false,
        })
        .example("$0 poverty", "Export the poverty article as XHTML")
        .example(
            "$0 poverty --pretty",
            "Export with pretty-printed XHTML output"
        )
        .help()
        .alias("h", "help")
        .parseSync()

    const slug = argv.slug as string

    if (!slug) {
        console.error("Error: slug is required")
        process.exit(1)
    }

    try {
        // Initialize the database connection
        await dataSource.initialize()

        // Query for the post by slug
        const result = await dataSource.query(
            `SELECT id, slug, type, content FROM posts_gdocs WHERE slug = ?`,
            [slug]
        )

        if (!result || result.length === 0) {
            console.error(`Error: No post found with slug "${slug}"`)
            process.exit(1)
        }

        const row = result[0]
        const content: OwidGdocContent = JSON.parse(row.content)

        if (!content.body || !Array.isArray(content.body)) {
            console.error(
                `Error: Post "${slug}" has no body content or body is not an array`
            )
            process.exit(1)
        }

        // Convert to XHTML
        const xhtml = enrichedBlocksToXhtmlDocument(content.body)

        // Output the XHTML
        if (argv.pretty) {
            // Simple pretty-print by adding newlines after closing tags
            const prettyXhtml = xhtml
                .replace(/></g, ">\n<")
                .replace(/(<\/gdoc>)/g, "\n$1")
            console.log(prettyXhtml)
        } else {
            console.log(xhtml)
        }
    } catch (error) {
        console.error("Error:", error)
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
