// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { PageRecord, OwidGdocType } from "@ourworldindata/types"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import {
    AI_SEARCH_R2_BUCKET,
    R2_ACCESS_KEY_ID,
    R2_ENDPOINT,
    R2_REGION,
    R2_SECRET_ACCESS_KEY,
} from "../../settings/serverSettings.js"
import { getPagesRecords } from "./utils/pages.js"

/**
 * Convert a PageRecord to Markdown format for AI Search indexing.
 * Metadata is stored separately in R2 object metadata (pagedata field).
 */
function pageRecordToMarkdown(record: PageRecord): string {
    const lines: string[] = []

    lines.push(`# ${record.title}`)
    lines.push("")

    if (record.excerpt) {
        lines.push(record.excerpt)
        lines.push("")
    }

    if (record.content) {
        lines.push(record.content)
        lines.push("")
    }

    if (record.tags && record.tags.length > 0) {
        lines.push("## Topics")
        lines.push(record.tags.join(", "))
        lines.push("")
    }

    if (record.authors && record.authors.length > 0) {
        lines.push("## Authors")
        lines.push(record.authors.join(", "))
        lines.push("")
    }

    return lines.join("\n")
}

/**
 * Get folder name for page type
 */
function getFolderForType(type: OwidGdocType): string {
    switch (type) {
        case OwidGdocType.Article:
            return "articles"
        case OwidGdocType.TopicPage:
        case OwidGdocType.LinearTopicPage:
            return "topic-pages"
        case OwidGdocType.AboutPage:
            return "about-pages"
        case OwidGdocType.DataInsight:
            return "data-insights"
        default:
            return "pages"
    }
}

/**
 * Upload a page record to R2 as a Markdown file.
 * Stores page metadata as JSON in a single metadata field to stay within R2 limits.
 */
async function uploadPageToR2(
    s3Client: S3Client,
    bucket: string,
    record: PageRecord
): Promise<void> {
    // Add timestamp to force AI Search to detect content change and re-index
    const timestamp = new Date().toISOString()
    const markdown =
        pageRecordToMarkdown(record) + `\n<!-- indexed: ${timestamp} -->\n`

    const folder = getFolderForType(record.type)
    const key = `${folder}/${record.slug}.md`

    // Store essential page data as JSON in metadata
    // R2 metadata values must be strings and have size limits
    // Note: We exclude content from metadata (it goes in the markdown body)
    // We base64 encode to avoid HTTP header character issues with UTF-8
    const pageDataObj = {
        type: record.type,
        slug: record.slug,
        title: record.title,
        excerpt: record.excerpt || "",
        authors: record.authors || [],
        tags: record.tags || [],
        date: record.date,
        modifiedDate: record.modifiedDate,
        views_7d: record.views_7d,
        score: record.score,
        thumbnailUrl: record.thumbnailUrl,
    }
    const pageData = Buffer.from(JSON.stringify(pageDataObj)).toString("base64")

    await s3Client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: markdown,
            ContentType: "text/markdown",
            Metadata: {
                // b64- prefix indicates base64 encoding for the API to decode
                pagedata: `b64-${pageData}`,
            },
        })
    )

    console.log(`Uploaded: ${key}`)
}

const indexPagesToAISearch = async () => {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        console.error(
            "R2 credentials are not set. Skipping AI Search indexing."
        )
        return
    }

    console.log(
        `Indexing pages to AI Search R2 bucket: ${AI_SEARCH_R2_BUCKET}`
    )

    const s3Client = new S3Client({
        endpoint: R2_ENDPOINT,
        region: R2_REGION,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    })

    const records = await db.knexReadonlyTransaction(
        getPagesRecords,
        db.TransactionCloseMode.Close
    )

    // Filter to only articles containing "demographics" keyword (for initial testing)
    const filteredRecords = records.filter(
        (record) =>
            record.type === OwidGdocType.Article &&
            (record.title.toLowerCase().includes("demographics") ||
                record.content?.toLowerCase().includes("demographics") ||
                record.tags?.some((tag) =>
                    tag.toLowerCase().includes("demographics")
                ))
    )

    console.log(
        `Found ${records.length} pages, ${filteredRecords.length} articles with "demographics"`
    )

    // Upload each page to R2
    let uploaded = 0
    for (const record of filteredRecords) {
        await uploadPageToR2(s3Client, AI_SEARCH_R2_BUCKET, record)
        uploaded++
    }

    console.log(`Successfully uploaded ${uploaded} pages to R2`)
}

indexPagesToAISearch().catch(async (e) => {
    console.error("Error in indexPagesToAISearch:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
