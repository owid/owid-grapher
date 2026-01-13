// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { OwidGdocType } from "@ourworldindata/types"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import {
    AI_SEARCH_R2_BUCKET,
    R2_ACCESS_KEY_ID,
    R2_ENDPOINT,
    R2_REGION,
    R2_SECRET_ACCESS_KEY,
} from "../../settings/serverSettings.js"
import { getAnalyticsPageviewsByUrlObj } from "../../db/model/Pageview.js"
import { RawPageview } from "@ourworldindata/utils"

/**
 * Gdoc data from database for AI Search indexing
 */
interface GdocForAISearch {
    id: string
    slug: string
    type: OwidGdocType
    title: string
    excerpt: string
    markdown: string
    authors: string[]
    tags: string[]
    publishedAt: Date
    updatedAt: Date | null
    thumbnailUrl: string
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
 * Build markdown content for AI Search indexing.
 * Uses the pre-rendered markdown from the database, with title and metadata.
 */
function buildMarkdownForAISearch(gdoc: GdocForAISearch): string {
    const lines: string[] = []

    // Title
    lines.push(`# ${gdoc.title}`)
    lines.push("")

    // Excerpt as lead paragraph
    if (gdoc.excerpt) {
        lines.push(gdoc.excerpt)
        lines.push("")
    }

    // Full markdown content from database
    if (gdoc.markdown) {
        lines.push(gdoc.markdown)
        lines.push("")
    }

    // Topics section for semantic search
    if (gdoc.tags && gdoc.tags.length > 0) {
        lines.push("## Topics")
        lines.push(gdoc.tags.join(", "))
        lines.push("")
    }

    // Authors section
    if (gdoc.authors && gdoc.authors.length > 0) {
        lines.push("## Authors")
        lines.push(gdoc.authors.join(", "))
        lines.push("")
    }

    return lines.join("\n")
}

/**
 * Upload a gdoc to R2 as a Markdown file.
 * Stores page metadata as JSON in a single metadata field to stay within R2 limits.
 */
async function uploadGdocToR2(
    s3Client: S3Client,
    bucket: string,
    gdoc: GdocForAISearch,
    pageviews: RawPageview | undefined
): Promise<void> {
    // Add timestamp to force AI Search to detect content change and re-index
    const timestamp = new Date().toISOString()
    const markdown =
        buildMarkdownForAISearch(gdoc) + `\n<!-- indexed: ${timestamp} -->\n`

    const folder = getFolderForType(gdoc.type)
    const key = `${folder}/${gdoc.slug}.md`

    // Store essential page data as JSON in metadata
    // R2 metadata values must be strings and have size limits
    // We base64 encode to avoid HTTP header character issues with UTF-8
    const pageDataObj = {
        type: gdoc.type,
        slug: gdoc.slug,
        title: gdoc.title,
        excerpt: gdoc.excerpt || "",
        authors: gdoc.authors || [],
        tags: gdoc.tags || [],
        date: gdoc.publishedAt?.toISOString(),
        modifiedDate: gdoc.updatedAt?.toISOString(),
        views_7d: pageviews?.views_7d ?? 0,
        thumbnailUrl: gdoc.thumbnailUrl || "",
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

/**
 * Get gdocs with markdown from database for AI Search indexing
 */
async function getGdocsForAISearch(
    trx: db.KnexReadonlyTransaction
): Promise<GdocForAISearch[]> {
    const rows = await trx
        .select(
            "g.id",
            "g.slug",
            "g.type",
            "g.markdown",
            "g.publishedAt",
            "g.updatedAt",
            trx.raw(
                "JSON_UNQUOTE(JSON_EXTRACT(g.content, '$.title')) as title"
            ),
            trx.raw(
                "JSON_UNQUOTE(JSON_EXTRACT(g.content, '$.excerpt')) as excerpt"
            ),
            trx.raw(
                "COALESCE(JSON_UNQUOTE(JSON_EXTRACT(g.content, '$.authors')), '[]') as authors"
            ),
            trx.raw(
                "JSON_UNQUOTE(JSON_EXTRACT(g.content, '$.\"featured-image\"')) as featuredImage"
            )
        )
        .from("posts_gdocs as g")
        .where("g.published", true)
        .whereIn("g.type", [
            OwidGdocType.Article,
            OwidGdocType.TopicPage,
            OwidGdocType.LinearTopicPage,
            OwidGdocType.AboutPage,
            OwidGdocType.DataInsight,
        ])
        .whereNotNull("g.markdown")

    // Get tags for each gdoc
    const gdocIds = rows.map((r) => r.id)
    const tagRows = await trx
        .select("gt.gdocId", "t.name")
        .from("posts_gdocs_x_tags as gt")
        .join("tags as t", "gt.tagId", "t.id")
        .whereIn("gt.gdocId", gdocIds)

    const tagsByGdocId = new Map<string, string[]>()
    for (const row of tagRows) {
        const tags = tagsByGdocId.get(row.gdocId) || []
        tags.push(row.name)
        tagsByGdocId.set(row.gdocId, tags)
    }

    return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        type: row.type as OwidGdocType,
        title: row.title || "",
        excerpt: row.excerpt || "",
        markdown: row.markdown || "",
        authors: JSON.parse(row.authors || "[]"),
        tags: tagsByGdocId.get(row.id) || [],
        publishedAt: row.publishedAt,
        updatedAt: row.updatedAt,
        thumbnailUrl: row.featuredImage
            ? `https://ourworldindata.org/images/${row.featuredImage}`
            : "",
    }))
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

    const { gdocs, pageviewsByUrl } = await db.knexReadonlyTransaction(
        async (trx) => {
            const gdocs = await getGdocsForAISearch(trx)
            const pageviewsByUrl = await getAnalyticsPageviewsByUrlObj(trx)
            return { gdocs, pageviewsByUrl }
        },
        db.TransactionCloseMode.Close
    )

    console.log(`Found ${gdocs.length} gdocs with markdown`)

    // Upload each gdoc to R2
    let uploaded = 0
    for (const gdoc of gdocs) {
        const pageviews = pageviewsByUrl[`/${gdoc.slug}`]
        await uploadGdocToR2(s3Client, AI_SEARCH_R2_BUCKET, gdoc, pageviews)
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
