// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { S3Client } from "@aws-sdk/client-s3"
import {
    AI_SEARCH_R2_BUCKET,
    R2_ACCESS_KEY_ID,
    R2_ENDPOINT,
    R2_REGION,
    R2_SECRET_ACCESS_KEY,
} from "../../settings/serverSettings.js"
import { uploadToR2 } from "./utils/aiSearch.js"
import parseArgs from "minimist"
import { TopicForAISearch } from "../../db/db.js"
import { toPlaintext } from "@ourworldindata/components"
import { stripCustomMarkdownComponents } from "../../db/model/Gdoc/enrichedToMarkdown.js"
import * as path from "path"
import * as fs from "fs"

interface CliArgs {
    slug?: string // Filter by slug
    invalidate?: boolean // Add timestamp to invalidate AI Search cache
    "dry-run"?: boolean // Print content without uploading
    "full-content"?: boolean // Include intro text (default: name only)
    "generate-json"?: boolean // Generate topics.json for CF Worker
    help?: boolean
}

function printUsage(): void {
    console.log(`
Usage: yarn tsx baker/algolia/indexTopicsToAISearch.ts [options]

Options:
  --slug <slug>     Filter topics by slug (e.g., --slug climate-change)
  --dry-run         Print markdown content without uploading to R2
  --full-content    Include intro text from topic page (default: name only)
  --generate-json   Generate topics.json file for CF Worker LLM mode
  --invalidate      Add timestamp to markdown to invalidate AI Search cache
  --help            Show this help message

Examples:
  # Index all topics
  yarn tsx baker/algolia/indexTopicsToAISearch.ts

  # Index only a specific topic
  yarn tsx baker/algolia/indexTopicsToAISearch.ts --slug climate-change

  # Preview what would be indexed (dry run)
  yarn tsx baker/algolia/indexTopicsToAISearch.ts --slug climate-change --dry-run

  # Include full intro text (for comparison)
  yarn tsx baker/algolia/indexTopicsToAISearch.ts --full-content --dry-run

  # Generate topics.json for CF Worker
  yarn tsx baker/algolia/indexTopicsToAISearch.ts --generate-json

  # Force re-indexing by invalidating cache
  yarn tsx baker/algolia/indexTopicsToAISearch.ts --invalidate
`)
}

/**
 * Format markdown content for AI Search by stripping custom components
 * and converting to plain text.
 */
function formatMarkdownContent(content: string): string {
    const simplifiedMarkdown = stripCustomMarkdownComponents(content)
    // Remove all asterisks (bold/italic markers)
    const withoutAsterisks = simplifiedMarkdown.replaceAll("*", "")
    const withoutMarkdown = toPlaintext(withoutAsterisks)
    const withoutNewlines = withoutMarkdown.replaceAll("\n", " ")

    // Remove footnote markers (e.g., "word.1")
    const withoutFootnotes = withoutNewlines.replaceAll(
        /([A-Za-z]\.)\d{1,2}/g,
        "$1"
    )
    // Remove arrows used in navigation
    const withoutArrow = withoutFootnotes.replaceAll("→", "")
    return withoutArrow.trim()
}

/**
 * Extract the first few paragraphs from the markdown as intro text.
 * Returns approximately the first 1500 characters of content.
 */
function extractIntroFromMarkdown(markdown: string): string {
    const formatted = formatMarkdownContent(markdown)
    // Limit to roughly the first 1500 characters for the intro
    const maxLength = 1500
    if (formatted.length <= maxLength) {
        return formatted
    }
    // Try to cut at a sentence boundary
    const truncated = formatted.slice(0, maxLength)
    const lastPeriod = truncated.lastIndexOf(". ")
    if (lastPeriod > maxLength * 0.7) {
        return truncated.slice(0, lastPeriod + 1)
    }
    return truncated + "..."
}

/**
 * Build markdown content for AI Search indexing.
 * By default, only includes the topic name for cleaner semantic matching.
 * With fullContent=true, includes excerpt and intro text.
 */
function buildMarkdownForAISearch(
    topic: TopicForAISearch,
    fullContent: boolean = false
): string {
    if (!fullContent) {
        // Just the plain topic name, no markdown formatting
        return topic.name
    }

    const lines: string[] = []

    // Title (tag name)
    lines.push(`# ${topic.name}`)
    lines.push("")

    // Excerpt
    if (topic.excerpt) {
        lines.push(topic.excerpt)
        lines.push("")
    }

    // Introduction from topic page content
    if (topic.markdown) {
        const intro = extractIntroFromMarkdown(topic.markdown)
        if (intro) {
            lines.push("## Introduction")
            lines.push(intro)
            lines.push("")
        }
    }

    return lines.join("\n")
}

interface TopicMetadata {
    id: number
    name: string
    slug: string
    excerpt: string
}

const indexTopicsToAISearch = async () => {
    // Parse CLI arguments
    const args = parseArgs(process.argv.slice(2), {
        string: ["slug"],
        boolean: [
            "help",
            "invalidate",
            "dry-run",
            "full-content",
            "generate-json",
        ],
    }) as CliArgs

    if (args.help) {
        printUsage()
        return
    }

    const slugFilter = args.slug
    const addTimestamp = args.invalidate || false
    const dryRun = args["dry-run"] || false
    const fullContent = args["full-content"] || false
    const generateJson = args["generate-json"] || false

    // Generate topics.json for CF Worker
    if (generateJson) {
        console.log("Generating topics.json for CF Worker...")

        const topics = await db.knexReadonlyTransaction(
            async (trx) => db.getTopicsForAISearch(trx),
            db.TransactionCloseMode.Close
        )

        const topicsData = topics.map((topic) => ({
            id: topic.id,
            name: topic.name,
            slug: topic.slug,
            excerpt: topic.excerpt,
        }))

        const outputPath = path.join(
            process.cwd(),
            "functions/api/ai-search/topics/topics.json"
        )

        fs.writeFileSync(outputPath, JSON.stringify(topicsData, null, 2))
        console.log(`Generated ${outputPath} with ${topicsData.length} topics`)
        return
    }

    if (!dryRun && (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY)) {
        console.error(
            "R2 credentials are not set. Skipping AI Search indexing."
        )
        return
    }

    if (dryRun) {
        console.log("DRY RUN - no files will be uploaded")
    } else {
        console.log(
            `Indexing topics to AI Search R2 bucket: ${AI_SEARCH_R2_BUCKET}`
        )
    }
    if (slugFilter) {
        console.log(`  Filtering by slug: ${slugFilter}`)
    }
    if (fullContent) {
        console.log(`  Including full content (excerpt + intro)`)
    } else {
        console.log(`  Name only (use --full-content for more)`)
    }
    if (addTimestamp) {
        console.log(`  Adding timestamp to invalidate cache`)
    }

    const s3Client = new S3Client({
        endpoint: R2_ENDPOINT,
        region: R2_REGION,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    })

    // Get topics from database
    let topics = await db.knexReadonlyTransaction(
        async (trx) => db.getTopicsForAISearch(trx),
        db.TransactionCloseMode.Close
    )

    // Apply filter
    if (slugFilter) {
        topics = topics.filter((t) => t.slug === slugFilter)
    }

    if (topics.length === 0) {
        console.error(
            `No topics found${slugFilter ? ` with slug: ${slugFilter}` : ""}`
        )
        return
    }

    console.log(`Processing ${topics.length} topics`)

    // Upload each topic to R2 (or print in dry-run mode)
    for (const topic of topics) {
        const key = `topics/${topic.slug}.md`
        const markdown = buildMarkdownForAISearch(topic, fullContent)

        const metadata: TopicMetadata = {
            id: topic.id,
            name: topic.name,
            slug: topic.slug,
            excerpt: topic.excerpt,
        }

        if (dryRun) {
            console.log("\n" + "=".repeat(80))
            console.log(`File: ${key}`)
            console.log("Metadata:", JSON.stringify(metadata, null, 2))
            console.log("-".repeat(80))
            console.log(markdown)
            console.log("=".repeat(80))
        } else {
            await uploadToR2(
                s3Client,
                AI_SEARCH_R2_BUCKET,
                key,
                markdown,
                "topicdata",
                metadata,
                {
                    metadataPrefix: "b64-",
                    addTimestamp,
                }
            )
        }
    }

    if (dryRun) {
        console.log(
            `\nDry run complete. ${topics.length} topics would be uploaded.`
        )
    } else {
        console.log(`Successfully uploaded ${topics.length} topics to R2`)
    }
}

indexTopicsToAISearch().catch(async (e) => {
    console.error("Error in indexTopicsToAISearch:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
