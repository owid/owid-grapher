#!/usr/bin/env tsx

/**
 * Export a Google Doc post as XHTML.
 *
 * Usage:
 *   yarn exportGdocXhtml <identifier> [--no-comments]
 *
 * The identifier can be either a slug or a Google Doc ID.
 *
 * Examples:
 *   yarn exportGdocXhtml poverty                          # By slug
 *   yarn exportGdocXhtml 1abc123def456                    # By Google Doc ID
 *   yarn exportGdocXhtml poverty --no-comments            # Without comments
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

interface GdocRow {
    id: string
    slug: string
    type: string
    content: string
}

/**
 * Try to find a gdoc by slug first, then by ID.
 */
async function findGdoc(identifier: string): Promise<GdocRow | null> {
    // First try by slug
    const bySlug = await dataSource.query(
        `SELECT id, slug, type, content FROM posts_gdocs WHERE slug = ?`,
        [identifier]
    )

    if (bySlug && bySlug.length > 0) {
        console.error(`Found document by slug: "${identifier}"`)
        return bySlug[0]
    }

    // Then try by ID
    const byId = await dataSource.query(
        `SELECT id, slug, type, content FROM posts_gdocs WHERE id = ?`,
        [identifier]
    )

    if (byId && byId.length > 0) {
        console.error(
            `Found document by ID: "${identifier}" (slug: "${byId[0].slug}")`
        )
        return byId[0]
    }

    return null
}

async function main() {
    const argv = yargs(hideBin(process.argv))
        .command(
            "$0 <identifier>",
            "Export a Google Doc post as XHTML",
            (yargs) => {
                yargs
                    .positional("identifier", {
                        describe:
                            "The slug or Google Doc ID of the post to export",
                        type: "string",
                        demandOption: true,
                    })
                    .option("comments", {
                        describe: "Include comments in the output",
                        type: "boolean",
                        default: true,
                    })
            }
        )
        .example("$0 poverty", "Export by slug with comments")
        .example("$0 1abc123def456", "Export by Google Doc ID")
        .example("$0 poverty --no-comments", "Export without comments")
        .help()
        .alias("h", "help")
        .parseSync()

    const identifier = argv.identifier as string
    const includeComments = argv.comments as boolean

    if (!identifier) {
        console.error("Error: identifier is required")
        process.exit(1)
    }

    try {
        // Initialize the database connection
        await dataSource.initialize()

        // Find the document by slug or ID
        const row = await findGdoc(identifier)

        if (!row) {
            console.error(
                `Error: No post found with slug or ID "${identifier}"`
            )
            process.exit(1)
        }

        let content: OwidGdocContent = JSON.parse(row.content)
        const documentId = row.id

        if (!content.body || !Array.isArray(content.body)) {
            console.error(
                `Error: Post "${row.slug}" has no body content or body is not an array`
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
