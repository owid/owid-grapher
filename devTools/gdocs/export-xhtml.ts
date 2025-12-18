#!/usr/bin/env tsx

/**
 * Export a Google Doc post as XHTML.
 *
 * Usage:
 *   yarn exportGdocXhtml <slug>
 *
 * Example:
 *   yarn exportGdocXhtml poverty
 *   yarn exportGdocXhtml poverty --compact
 */

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { dataSource } from "../../db/dataSource.js"
import { enrichedBlocksToXhtmlDocument } from "../../db/model/Gdoc/enrichedToXhtml.js"
import { OwidGdocContent } from "@ourworldindata/types"

/**
 * Pretty-print XHTML with proper indentation.
 * Self-closing tags and inline content stay on one line.
 */
function prettyPrintXhtml(xhtml: string, indentSize = 2): string {
    const lines: string[] = []
    let depth = 0
    const indent = () => " ".repeat(depth * indentSize)

    // Split into tokens: tags and text content
    const tokens = xhtml.split(/(<[^>]+>)/g).filter((t) => t.length > 0)

    for (const token of tokens) {
        if (!token.startsWith("<")) {
            // Text content - add to current line if not just whitespace
            const trimmed = token.trim()
            if (trimmed) {
                // Inline text content - append to last line if possible
                if (
                    lines.length > 0 &&
                    !lines[lines.length - 1].endsWith(">")
                ) {
                    lines[lines.length - 1] += token
                } else {
                    lines.push(indent() + trimmed)
                }
            }
            continue
        }

        const isClosingTag = token.startsWith("</")
        const isSelfClosing = token.endsWith("/>")
        const isXmlDeclaration = token.startsWith("<?")

        if (isXmlDeclaration) {
            lines.push(token)
        } else if (isClosingTag) {
            depth = Math.max(0, depth - 1)
            // Check if the last line is an opening tag for this element
            const lastLine = lines[lines.length - 1] || ""
            const tagName = token.match(/<\/([a-z-]+)>/i)?.[1]
            if (
                tagName &&
                lastLine.includes(`<${tagName}`) &&
                !lastLine.includes(`</${tagName}>`)
            ) {
                // Inline the closing tag with the content
                lines[lines.length - 1] += token
            } else {
                lines.push(indent() + token)
            }
        } else if (isSelfClosing) {
            lines.push(indent() + token)
        } else {
            // Opening tag
            lines.push(indent() + token)
            depth++
        }
    }

    return lines.join("\n")
}

async function main() {
    const argv = yargs(hideBin(process.argv))
        .command("$0 <slug>", "Export a Google Doc post as XHTML", (yargs) => {
            yargs.positional("slug", {
                describe: "The slug of the post to export",
                type: "string",
                demandOption: true,
            })
        })
        .option("compact", {
            alias: "c",
            type: "boolean",
            description: "Output compact XHTML without formatting",
            default: false,
        })
        .example("$0 poverty", "Export the poverty article as formatted XHTML")
        .example("$0 poverty --compact", "Export as compact single-line XHTML")
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

        // Output the XHTML (pretty-printed by default)
        if (argv.compact) {
            console.log(xhtml)
        } else {
            console.log(prettyPrintXhtml(xhtml))
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
