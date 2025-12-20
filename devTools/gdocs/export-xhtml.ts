#!/usr/bin/env tsx

/**
 * Export a Google Doc post as XHTML.
 *
 * Usage:
 *   yarn exportGdocXhtml <slug> [--no-comments]
 *
 * Examples:
 *   yarn exportGdocXhtml poverty                # With comments
 *   yarn exportGdocXhtml poverty --no-comments  # Without comments
 */

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { dataSource } from "../../db/dataSource.js"
import {
    enrichedBlocksToXhtmlDocument,
    XhtmlSerializationOptions,
} from "../../db/model/Gdoc/enrichedToXhtml.js"
import { fetchGdocComments } from "../../db/model/Gdoc/fetchGdocComments.js"
import { anchorCommentsToContent } from "../../db/model/Gdoc/anchorCommentsToSpans.js"
import { OwidGdocContent, GdocComments } from "@ourworldindata/types"

async function main() {
    const argv = yargs(hideBin(process.argv))
        .command("$0 <slug>", "Export a Google Doc post as XHTML", (yargs) => {
            yargs
                .positional("slug", {
                    describe: "The slug of the post to export",
                    type: "string",
                    demandOption: true,
                })
                .option("comments", {
                    describe: "Include comments in the output",
                    type: "boolean",
                    default: true,
                })
        })
        .example("$0 poverty", "Export the poverty article with comments")
        .example(
            "$0 poverty --no-comments",
            "Export the poverty article without comments"
        )
        .help()
        .alias("h", "help")
        .parseSync()

    const slug = argv.slug as string
    const includeComments = argv.comments as boolean

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
        let content: OwidGdocContent = JSON.parse(row.content)
        const documentId = row.id

        if (!content.body || !Array.isArray(content.body)) {
            console.error(
                `Error: Post "${slug}" has no body content or body is not an array`
            )
            process.exit(1)
        }

        // Fetch fresh comments from the API and anchor them to the content
        let comments: GdocComments | null = null
        if (includeComments) {
            console.error(`Fetching comments for document ${documentId}...`)
            comments = await fetchGdocComments(documentId)
            if (comments && comments.threads.length > 0) {
                console.error(
                    `Found ${comments.threads.length} comment thread(s)`
                )
                // Anchor comments to text spans
                content = anchorCommentsToContent(content, comments)
            } else {
                console.error("No comments found")
            }
        }

        // Serialization options
        const options: XhtmlSerializationOptions = {
            includeComments,
        }

        // Convert to XHTML (pretty-printed by default)
        const xhtml = enrichedBlocksToXhtmlDocument(
            content.body,
            comments,
            options
        )
        console.log(xhtml)
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
