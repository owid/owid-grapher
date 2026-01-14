// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { OwidGdocType, PageRecord } from "@ourworldindata/types"
import { S3Client } from "@aws-sdk/client-s3"
import {
    AI_SEARCH_R2_BUCKET,
    R2_ACCESS_KEY_ID,
    R2_ENDPOINT,
    R2_REGION,
    R2_SECRET_ACCESS_KEY,
} from "../../settings/serverSettings.js"
import { getPagesRecords } from "./utils/pages.js"
import { uploadToR2 } from "./utils/aiSearch.js"

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
 * Build markdown content for AI Search indexing.
 * Uses the content field from Algolia records.
 */
function buildMarkdownForAISearch(record: PageRecord): string {
    const lines: string[] = []

    // Title
    lines.push(`# ${record.title}`)
    lines.push("")

    // Excerpt as lead paragraph
    if (record.excerpt) {
        lines.push(record.excerpt)
        lines.push("")
    }

    // Full content from Algolia record
    if (record.content) {
        lines.push(record.content)
        lines.push("")
    }

    // Topics section for semantic search
    if (record.tags && record.tags.length > 0) {
        lines.push("## Topics")
        lines.push(record.tags.join(", "))
        lines.push("")
    }

    // Authors section
    if (record.authors && record.authors.length > 0) {
        lines.push("## Authors")
        lines.push(record.authors.join(", "))
        lines.push("")
    }

    return lines.join("\n")
}

interface PageMetadata {
    type: OwidGdocType
    slug: string
    title: string
    excerpt: string
    authors: string[]
    tags: string[]
    date: string | undefined
    modifiedDate: string | undefined
    views_7d: number
    views_14d: number
    views_365d: number
    thumbnailUrl: string
}

const indexPagesToAISearch = async () => {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        console.error(
            "R2 credentials are not set. Skipping AI Search indexing."
        )
        return
    }

    console.log(`Indexing pages to AI Search R2 bucket: ${AI_SEARCH_R2_BUCKET}`)

    const s3Client = new S3Client({
        endpoint: R2_ENDPOINT,
        region: R2_REGION,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    })

    // Reuse the same records generation as Algolia indexing, but without chunking
    const records = await db.knexReadonlyTransaction(
        async (trx) => getPagesRecords(trx, { skipChunking: true }),
        db.TransactionCloseMode.Close
    )

    console.log(`Uploading ${records.length} pages`)

    // Upload each page to R2
    for (const record of records) {
        const folder = getFolderForType(record.type)
        const key = `${folder}/${record.slug}.md`
        const markdown = buildMarkdownForAISearch(record)

        const metadata: PageMetadata = {
            type: record.type,
            slug: record.slug,
            title: record.title,
            excerpt: record.excerpt || "",
            authors: record.authors || [],
            tags: record.tags || [],
            date: record.date,
            modifiedDate: record.modifiedDate,
            views_7d: record.views_7d ?? 0,
            views_14d: record.views_14d ?? 0,
            views_365d: record.views_365d ?? 0,
            thumbnailUrl: record.thumbnailUrl || "",
        }

        await uploadToR2(s3Client, AI_SEARCH_R2_BUCKET, key, markdown, "pagedata", metadata, {
            metadataPrefix: "b64-",
        })
    }

    console.log(`Successfully uploaded ${records.length} pages to R2`)
}

indexPagesToAISearch().catch(async (e) => {
    console.error("Error in indexPagesToAISearch:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
