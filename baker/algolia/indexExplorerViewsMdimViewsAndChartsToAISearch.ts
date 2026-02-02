// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { ChartRecord, ChartRecordType } from "@ourworldindata/types"
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
import { getChartsRecords } from "./utils/charts.js"
import { getExplorerViewRecords } from "./utils/explorerViews.js"
import { getMdimViewRecords } from "./utils/mdimViews.js"
import parseArgs from "minimist"

interface CliArgs {
    slug?: string // Filter by slug (works for explorers, mdims, and charts)
    type?: "charts" | "explorers" | "mdim" | "all" // Filter by record type
    invalidate?: boolean // Add timestamp to invalidate AI Search cache
    help?: boolean
}

function printUsage(): void {
    console.log(`
Usage: yarn tsx baker/algolia/indexExplorerViewsMdimViewsAndChartsToAISearch.ts [options]

Options:
  --slug <slug>     Filter records by slug (e.g., --slug migration-flows)
  --type <type>     Filter by record type: charts, explorers, mdim, or all (default: all)
  --invalidate      Add timestamp to markdown to invalidate AI Search cache
  --help            Show this help message

Examples:
  # Index only the migration-flows explorer
  yarn tsx baker/algolia/indexExplorerViewsMdimViewsAndChartsToAISearch.ts --slug migration-flows

  # Index only charts
  yarn tsx baker/algolia/indexExplorerViewsMdimViewsAndChartsToAISearch.ts --type charts

  # Index a specific chart
  yarn tsx baker/algolia/indexExplorerViewsMdimViewsAndChartsToAISearch.ts --slug population --type charts

  # Force re-indexing by invalidating cache
  yarn tsx baker/algolia/indexExplorerViewsMdimViewsAndChartsToAISearch.ts --invalidate
`)
}

/**
 * Convert a ChartRecord to Markdown format for AI Search indexing.
 * Works for charts, explorer views, and mdim views.
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
async function getFmRankByPath(
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

/**
 * Get the URL path for a record based on its type.
 */
function getRecordPath(record: ChartRecord): string {
    switch (record.type) {
        case ChartRecordType.ExplorerView:
            return `/explorers/${record.slug}${record.queryParams || ""}`
        case ChartRecordType.MultiDimView:
            return `/grapher/${record.slug}?${record.queryParams || ""}`
        case ChartRecordType.Chart:
        default:
            return `/grapher/${record.slug}`
    }
}

/**
 * Get the R2 key prefix for a record based on its type.
 */
function getRecordKeyPrefix(record: ChartRecord): string {
    switch (record.type) {
        case ChartRecordType.ExplorerView:
            return "explorers"
        case ChartRecordType.MultiDimView:
            return "mdim"
        case ChartRecordType.Chart:
        default:
            return "charts"
    }
}

/**
 * Get a unique filename for a record.
 * For records with query params, we use the objectID to ensure uniqueness.
 */
function getRecordFilename(record: ChartRecord): string {
    const prefix = getRecordKeyPrefix(record)
    // Use objectID for explorer views and mdim views since they have query params
    // that would create duplicate slugs
    if (
        record.type === ChartRecordType.ExplorerView ||
        record.type === ChartRecordType.MultiDimView
    ) {
        return `${prefix}/${record.objectID}.md`
    }
    return `${prefix}/${record.slug}.md`
}

interface RecordMetadata {
    type: ChartRecordType
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
    tag1: string
    tag2: string
    tag3: string
    tag4: string
}

const indexExplorerViewsMdimViewsAndChartsToAISearch = async () => {
    // Parse CLI arguments
    const args = parseArgs(process.argv.slice(2), {
        string: ["slug", "type"],
        boolean: ["help", "invalidate"],
        default: { type: "all" },
    }) as CliArgs

    if (args.help) {
        printUsage()
        return
    }

    const slugFilter = args.slug
    const typeFilter = args.type || "all"
    const addTimestamp = args.invalidate || false

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        console.error(
            "R2 credentials are not set. Skipping AI Search indexing."
        )
        return
    }

    console.log(
        `Indexing explorer views, mdim views, and charts to AI Search R2 bucket: ${AI_SEARCH_R2_BUCKET}`
    )
    if (slugFilter) {
        console.log(`  Filtering by slug: ${slugFilter}`)
    }
    if (typeFilter !== "all") {
        console.log(`  Filtering by type: ${typeFilter}`)
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

    const { records, fmRankByPath } = await db.knexReadonlyTransaction(
        async (trx) => {
            // Fetch record types based on filter
            const shouldFetchExplorers =
                typeFilter === "all" || typeFilter === "explorers"
            const shouldFetchMdim =
                typeFilter === "all" || typeFilter === "mdim"
            const shouldFetchCharts =
                typeFilter === "all" || typeFilter === "charts"

            // Pass slug filter to each fetcher to avoid loading unnecessary data
            const explorerSlugFilter =
                shouldFetchExplorers && slugFilter ? slugFilter : undefined
            const mdimSlugFilter =
                shouldFetchMdim && slugFilter ? slugFilter : undefined
            const chartSlugFilter =
                shouldFetchCharts && slugFilter ? slugFilter : undefined

            const explorerViews = shouldFetchExplorers
                ? await getExplorerViewRecords(trx, true, explorerSlugFilter)
                : []
            const mdimViews = shouldFetchMdim
                ? await getMdimViewRecords(trx, mdimSlugFilter)
                : []
            const grapherViews = shouldFetchCharts
                ? await getChartsRecords(trx, chartSlugFilter)
                : []

            const records = [...grapherViews, ...explorerViews, ...mdimViews]

            // Get FM rankings
            const fmRankByPath = await getFmRankByPath(trx)

            return { records, fmRankByPath }
        },
        db.TransactionCloseMode.Close
    )

    if (records.length === 0) {
        console.error(
            `No records found${slugFilter ? ` with slug: ${slugFilter}` : ""}`
        )
        return
    }

    console.log(`Found ${records.length} records to upload`)
    console.log(`Found ${fmRankByPath.size} featured metrics`)

    // Count by type
    const countByType = records.reduce(
        (acc, r) => {
            acc[r.type] = (acc[r.type] || 0) + 1
            return acc
        },
        {} as Record<string, number>
    )
    console.log(`  Charts: ${countByType[ChartRecordType.Chart] || 0}`)
    console.log(
        `  Explorer views: ${countByType[ChartRecordType.ExplorerView] || 0}`
    )
    console.log(
        `  Mdim views: ${countByType[ChartRecordType.MultiDimView] || 0}`
    )

    // Upload each record to R2
    let uploaded = 0
    let fmCount = 0
    for (const record of records) {
        // Look up FM rank by record path
        const recordPath = getRecordPath(record)
        const fmRank = fmRankByPath.get(recordPath)
        if (fmRank) {
            fmCount++
        }

        const markdown = chartRecordToMarkdown(record)
        const key = getRecordFilename(record)

        const metadata: RecordMetadata = {
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
            tag1: record.tags[0] || "",
            tag2: record.tags[1] || "",
            tag3: record.tags[2] || "",
            tag4: record.tags[3] || "",
        }

        await uploadToR2(
            s3Client,
            AI_SEARCH_R2_BUCKET,
            key,
            markdown,
            "chartdata",
            metadata,
            { addTimestamp }
        )
        uploaded++
    }

    console.log(`Found ${fmCount} featured metrics among all records`)
    console.log(`Successfully uploaded ${uploaded} records to R2`)
}

indexExplorerViewsMdimViewsAndChartsToAISearch().catch(async (e) => {
    console.error("Error in indexExplorerViewsMdimViewsAndChartsToAISearch:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
