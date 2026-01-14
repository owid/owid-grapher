// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { getChartsRecords } from "./utils/charts.js"
import { ChartRecord } from "@ourworldindata/types"
import { getFeaturedMetricsByParentTagName } from "../../db/db.js"
import { S3Client } from "@aws-sdk/client-s3"
import {
    AI_SEARCH_R2_BUCKET,
    R2_ACCESS_KEY_ID,
    R2_ENDPOINT,
    R2_REGION,
    R2_SECRET_ACCESS_KEY,
} from "../../settings/serverSettings.js"
import { uploadToR2 } from "./utils/aiSearch.js"

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
 *
 * We only consider FMs with incomeGroup="default" since that's the primary ranking.
 * Other income groups (low, lower-middle, upper-middle) are for country-specific views.
 */
async function getFmRankByChartPath(
    trx: db.KnexReadonlyTransaction
): Promise<Map<string, number>> {
    const fmsByTag = await getFeaturedMetricsByParentTagName(trx)
    const fmRankByPath = new Map<string, number>()

    for (const fms of Object.values(fmsByTag)) {
        for (const fm of fms) {
            // Only consider default income group (primary ranking)
            if (fm.incomeGroup !== "default") continue

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

interface ChartMetadata {
    type: string
    slug: string
    variantName: string
    availableTabs: string[]
    queryParams: string
    publishedAt: string
    updatedAt: string
    views_7d: number
    views_14d: number
    views_365d: number
    fmRank: number | undefined
}

const indexChartsToAISearch = async () => {
    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        console.error(
            "R2 credentials are not set. Skipping AI Search indexing."
        )
        return
    }

    console.log(
        `Indexing charts to AI Search R2 bucket: ${AI_SEARCH_R2_BUCKET}`
    )

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

    console.log(`Found ${records.length} charts`)
    console.log(`Found ${fmRankByPath.size} featured metrics`)

    // Upload each chart to R2
    let uploaded = 0
    let fmCount = 0
    for (const record of records) {
        // Look up FM rank by chart path
        const chartPath = `/grapher/${record.slug}`
        const fmRank = fmRankByPath.get(chartPath)
        if (fmRank) {
            console.log(`  FM: ${record.slug} => rank ${fmRank}`)
            fmCount++
        }

        const markdown = chartRecordToMarkdown(record)
        const key = `charts/${record.slug}.md`

        // Use views from the ChartRecord (already computed in getChartsRecords)
        const metadata: ChartMetadata = {
            type: record.type,
            slug: record.slug,
            variantName: record.variantName || "",
            availableTabs: record.availableTabs,
            queryParams: record.queryParams || "",
            publishedAt: record.publishedAt,
            updatedAt: record.updatedAt,
            views_7d: record.views_7d,
            views_14d: record.views_14d,
            views_365d: record.views_365d,
            fmRank,
        }

        await uploadToR2(
            s3Client,
            AI_SEARCH_R2_BUCKET,
            key,
            markdown,
            "chartdata",
            metadata
        )
        uploaded++
    }
    console.log(`Found ${fmCount} featured metrics among charts`)

    console.log(`Successfully uploaded ${uploaded} charts to R2`)
}

indexChartsToAISearch().catch(async (e) => {
    console.error("Error in indexChartsToAISearch:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
