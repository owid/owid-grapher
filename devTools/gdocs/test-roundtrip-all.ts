#!/usr/bin/env tsx

/**
 * Test XHTML round-trip for all posts in the posts_gdocs table.
 * Writes failures to ./tmp/roundtrip-tests/ for inspection.
 *
 * Usage:
 *   yarn testGdocRoundtrip
 */

import * as fs from "fs"
import * as path from "path"
import { dataSource } from "../../db/dataSource.js"
import {
    enrichedBlocksToXhtmlDocument,
    enrichedBlockToXhtml,
} from "../../db/model/Gdoc/enrichedToXhtml.js"
import { xhtmlToRawBlocks } from "../../db/model/Gdoc/xhtmlToEnriched.js"
import { parseRawBlocksToEnrichedBlocks } from "../../db/model/Gdoc/rawToEnriched.js"
import {
    OwidGdocContent,
    OwidEnrichedGdocBlock,
    omitUndefinedValues,
    excludeNullish,
} from "@ourworldindata/utils"

const OUTPUT_DIR = "./tmp/roundtrip-tests"

interface TestResult {
    slug: string
    id: string
    type: string
    success: boolean
    blockErrors: BlockError[]
}

interface BlockError {
    blockIndex: number
    blockType: string
    error: string
    original: OwidEnrichedGdocBlock
    roundTripped: OwidEnrichedGdocBlock | null
    xhtml: string
}

function sortObjectKeys(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") {
        return obj
    }
    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys)
    }
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
        sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
    }
    return sorted
}

function deepEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(sortObjectKeys(a)) === JSON.stringify(sortObjectKeys(b))
}

function testBlockRoundtrip(
    block: OwidEnrichedGdocBlock,
    blockIndex: number
): BlockError | null {
    try {
        // Serialize to XHTML
        const xhtml = enrichedBlockToXhtml(block)

        // Parse back to raw blocks
        const rawBlocks = xhtmlToRawBlocks(xhtml)
        if (rawBlocks.length !== 1) {
            return {
                blockIndex,
                blockType: block.type,
                error: `Expected 1 raw block, got ${rawBlocks.length}`,
                original: block,
                roundTripped: null,
                xhtml,
            }
        }

        // Convert to enriched
        const enriched = parseRawBlocksToEnrichedBlocks(rawBlocks[0])
        if (!enriched) {
            return {
                blockIndex,
                blockType: block.type,
                error: "Failed to parse raw block to enriched",
                original: block,
                roundTripped: null,
                xhtml,
            }
        }

        // Compare
        const originalNormalized = omitUndefinedValues(block)
        const roundTrippedNormalized = omitUndefinedValues(enriched)

        if (!deepEqual(originalNormalized, roundTrippedNormalized)) {
            return {
                blockIndex,
                blockType: block.type,
                error: "Round-trip mismatch",
                original: block,
                roundTripped: enriched,
                xhtml,
            }
        }

        return null
    } catch (e) {
        return {
            blockIndex,
            blockType: block.type,
            error: e instanceof Error ? e.message : String(e),
            original: block,
            roundTripped: null,
            xhtml: "",
        }
    }
}

function testDocumentRoundtrip(
    blocks: OwidEnrichedGdocBlock[]
): BlockError | null {
    try {
        // Test full document round-trip with prettification
        const xhtml = enrichedBlocksToXhtmlDocument(blocks)
        const rawBlocks = xhtmlToRawBlocks(xhtml)
        const enrichedBlocks = excludeNullish(
            rawBlocks.map(parseRawBlocksToEnrichedBlocks)
        )

        if (enrichedBlocks.length !== blocks.length) {
            return {
                blockIndex: -1,
                blockType: "document",
                error: `Block count mismatch: expected ${blocks.length}, got ${enrichedBlocks.length}`,
                original: { type: "text", value: [], parseErrors: [] },
                roundTripped: null,
                xhtml,
            }
        }

        return null
    } catch (e) {
        return {
            blockIndex: -1,
            blockType: "document",
            error: e instanceof Error ? e.message : String(e),
            original: { type: "text", value: [], parseErrors: [] },
            roundTripped: null,
            xhtml: "",
        }
    }
}

function writeFailureReport(result: TestResult): void {
    // Sanitize slug for filename (replace / with __)
    const safeSlug = (result.slug || result.id).replace(/\//g, "__")
    const filename = `${safeSlug}.txt`
    const filepath = path.join(OUTPUT_DIR, filename)

    let content = `Round-trip test failure for: ${result.slug}\n`
    content += `ID: ${result.id}\n`
    content += `Type: ${result.type}\n`
    content += `Total block errors: ${result.blockErrors.length}\n`
    content += `${"=".repeat(80)}\n\n`

    for (const error of result.blockErrors) {
        content += `Block ${error.blockIndex} (${error.blockType}):\n`
        content += `Error: ${error.error}\n\n`

        if (error.xhtml) {
            content += `XHTML:\n${error.xhtml}\n\n`
        }

        content += `Original:\n${JSON.stringify(error.original, null, 2)}\n\n`

        if (error.roundTripped) {
            content += `Round-tripped:\n${JSON.stringify(error.roundTripped, null, 2)}\n\n`
        }

        content += `${"-".repeat(80)}\n\n`
    }

    fs.writeFileSync(filepath, content)
}

async function main(): Promise<void> {
    // Ensure output directory exists
    if (fs.existsSync(OUTPUT_DIR)) {
        // Clean up old files
        for (const file of fs.readdirSync(OUTPUT_DIR)) {
            fs.unlinkSync(path.join(OUTPUT_DIR, file))
        }
    } else {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    }

    console.log("Connecting to database...")
    await dataSource.initialize()

    try {
        // Fetch all posts
        console.log("Fetching all posts from posts_gdocs...")
        const posts = await dataSource.query(
            `SELECT id, slug, type, content FROM posts_gdocs`
        )

        console.log(`Found ${posts.length} posts to test\n`)

        let passed = 0
        let failed = 0
        const failures: TestResult[] = []

        for (const post of posts) {
            const content: OwidGdocContent = JSON.parse(post.content)
            const blocks = content.body

            if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
                // Skip posts without body content
                continue
            }

            const result: TestResult = {
                slug: post.slug,
                id: post.id,
                type: post.type,
                success: true,
                blockErrors: [],
            }

            // Test document-level round-trip first
            const docError = testDocumentRoundtrip(blocks)
            if (docError) {
                result.success = false
                result.blockErrors.push(docError)
            }

            // Test each block individually
            for (let i = 0; i < blocks.length; i++) {
                const blockError = testBlockRoundtrip(blocks[i], i)
                if (blockError) {
                    result.success = false
                    result.blockErrors.push(blockError)
                }
            }

            if (result.success) {
                passed++
                process.stdout.write(".")
            } else {
                failed++
                process.stdout.write("F")
                failures.push(result)
                writeFailureReport(result)
            }
        }

        console.log("\n")
        console.log(`${"=".repeat(80)}`)
        console.log(`Results: ${passed} passed, ${failed} failed`)

        if (failures.length > 0) {
            console.log(`\nFailures written to ${OUTPUT_DIR}/`)
            console.log("\nFailed posts:")
            for (const f of failures) {
                console.log(
                    `  - ${f.slug} (${f.type}): ${f.blockErrors.length} block errors`
                )
            }
        }
    } finally {
        await dataSource.destroy()
    }
}

main().catch((error) => {
    console.error("Error:", error)
    process.exit(1)
})
