// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { getChartsRecords } from "./utils/charts.js"
import { ChartRecord } from "@ourworldindata/types"
import { getFeaturedMetricsByParentTagName } from "../../db/db.js"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import {
    AI_SEARCH_R2_BUCKET,
    R2_ACCESS_KEY_ID,
    R2_ENDPOINT,
    R2_REGION,
    R2_SECRET_ACCESS_KEY,
} from "../../settings/serverSettings.js"

/**
 * Convert a ChartRecord to Markdown format for AI Search indexing.
 * Metadata is stored separately in R2 object metadata (chartdata field).
 */
function chartRecordToMarkdown(record: ChartRecord): string {
    const lines: string[] = []

    lines.push(`# ${record.title}`)
    lines.push("")

    if (record.subtitle) {
        lines.push(record.subtitle)
        lines.push("")
    }

    if (record.tags.length > 0) {
        lines.push("## Topics")
        lines.push(record.tags.join(", "))
        lines.push("")
    }

    return lines.join("\n")
}

/**
 * Build a map of chart URL path -> minimum FM rank for that chart.
 * A chart can be a featured metric for multiple topics, so we take the best (lowest) rank.
 */
async function getFmRankByChartPath(
    trx: db.KnexReadonlyTransaction
): Promise<Map<string, number>> {
    const fmsByTag = await getFeaturedMetricsByParentTagName(trx)
    const fmRankByPath = new Map<string, number>()

    for (const fms of Object.values(fmsByTag)) {
        for (const fm of fms) {
            // Extract path from URL (e.g., "/grapher/population" from full URL)
            const url = new URL(fm.url, "https://ourworldindata.org")
            const path = url.pathname + url.search

            const existingRank = fmRankByPath.get(path)
            if (!existingRank || fm.ranking < existingRank) {
                fmRankByPath.set(path, fm.ranking)
            }
        }
    }

    return fmRankByPath
}

/**
 * Upload a chart record to R2 as a Markdown file.
 * Stores chart metadata as JSON in a single metadata field to stay within R2 limits.
 */
async function uploadChartToR2(
    s3Client: S3Client,
    bucket: string,
    record: ChartRecord,
    fmRank: number | undefined
): Promise<void> {
    const markdown = chartRecordToMarkdown(record)
    const key = `charts/${record.slug}.md`

    // Store essential chart data as JSON in metadata
    // R2 metadata values must be strings and have size limits
    const chartData = JSON.stringify({
        type: record.type,
        slug: record.slug,
        variantName: record.variantName || "",
        availableTabs: record.availableTabs,
        queryParams: record.queryParams || "",
        publishedAt: record.publishedAt,
        updatedAt: record.updatedAt,
        views_7d: record.views_7d,
        fmRank,
    })

    await s3Client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: markdown,
            ContentType: "text/markdown",
            Metadata: {
                chartdata: chartData,
            },
        })
    )

    console.log(`Uploaded: ${key}`)
}

const indexChartsToAISearch = async () => {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        console.error(
            "R2 credentials are not set. Skipping AI Search indexing."
        )
        return
    }

    console.log(`Indexing charts to AI Search R2 bucket: ${AI_SEARCH_R2_BUCKET}`)

    const s3Client = new S3Client({
        endpoint: R2_ENDPOINT,
        region: R2_REGION,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    })

    const { records, fmRankByPath } = await db.knexReadonlyTransaction(
        async (trx) => {
            const records = await getChartsRecords(trx)
            const fmRankByPath = await getFmRankByChartPath(trx)
            return { records, fmRankByPath }
        },
        db.TransactionCloseMode.Close
    )

    // Filter to only charts with "pop" in title (for initial testing)
    const filteredRecords = records.filter((record) =>
        record.title.toLowerCase().includes("pop")
    )

    console.log(
        `Found ${records.length} charts, ${filteredRecords.length} with "pop" in title`
    )
    console.log(`Found ${fmRankByPath.size} featured metrics`)

    // Upload each chart to R2
    let uploaded = 0
    let fmCount = 0
    for (const record of filteredRecords) {
        // Look up FM rank by chart path
        const chartPath = `/grapher/${record.slug}`
        const fmRank = fmRankByPath.get(chartPath)
        if (fmRank) {
            console.log(`  FM: ${record.slug} => rank ${fmRank}`)
            fmCount++
        }
        await uploadChartToR2(s3Client, AI_SEARCH_R2_BUCKET, record, fmRank)
        uploaded++
    }
    console.log(`Found ${fmCount} featured metrics among filtered charts`)

    console.log(`Successfully uploaded ${uploaded} charts to R2`)
}

indexChartsToAISearch().catch(async (e) => {
    console.error("Error in indexChartsToAISearch:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
