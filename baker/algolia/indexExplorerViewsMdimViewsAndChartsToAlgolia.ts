// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import {
    getExplorerViewRecords,
    scaleExplorerRecordScores,
} from "./utils/explorerViews.js"
import {
    createFeaturedMetricRecords,
    MAX_NON_FM_RECORD_SCORE,
    scaleRecordScores,
} from "./utils/shared.js"
import { getChartsRecords } from "./utils/charts.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { SearchIndexName, ChartRecord } from "../../site/search/searchTypes.js"
import { getMdimViewRecords } from "./utils/mdimViews.js"
import { extractSearchSuggestions } from "./extractSearchSuggestions.js"
import {
    getAllSearchSuggestions,
    upsertSearchSuggestion,
} from "./utils/searchSuggestions.js"
import { pMapIterable } from "p-map"
import ProgressBar from "progress"

const processSuggestionForRecord = async (
    record: ChartRecord,
    cachedSuggestions: Map<string, { suggestion: string; score: number }>,
    progressBar: ProgressBar
): Promise<string | null> => {
    // Check if we already have a cached suggestion
    const cached = cachedSuggestions.get(record.title)
    if (cached) {
        // If current record has a higher score, update cache and database
        if (record.score > cached.score) {
            await db.knexReadWriteTransaction(async (trx) => {
                await upsertSearchSuggestion(
                    trx,
                    record.title,
                    cached.suggestion,
                    record.score
                )
            }, db.TransactionCloseMode.Close)

            cachedSuggestions.set(record.title, {
                suggestion: cached.suggestion,
                score: record.score,
            })
            progressBar.tick({
                slug: `📈 ${record.title} (score updated: ${cached.score} → ${record.score})`,
            })
        } else {
            progressBar.tick({ slug: `🔄 ${record.title} (cached)` })
        }
        return cached.suggestion
    }

    // Generate new suggestion
    const result = await extractSearchSuggestions([record.title])
    const suggestion = result.get(record.title)

    if (!suggestion) {
        progressBar.tick({
            slug: `⚠️ ${record.title} (no suggestion generated)`,
        })
        return null
    }

    // Store suggestion in database and cache with the chart's score
    await db.knexReadWriteTransaction(async (trx) => {
        await upsertSearchSuggestion(
            trx,
            record.title,
            suggestion,
            record.score
        )
    }, db.TransactionCloseMode.Close)

    cachedSuggestions.set(record.title, { suggestion, score: record.score })
    progressBar.tick({ slug: `✅ ${record.title}` })
    return suggestion
}

const processRecord = async (
    record: ChartRecord,
    cachedSuggestions: Map<string, { suggestion: string; score: number }>,
    progressBar: ProgressBar
): Promise<ChartRecord & { searchSuggestion?: string }> => {
    try {
        const suggestion = await processSuggestionForRecord(
            record,
            cachedSuggestions,
            progressBar
        )
        return suggestion ? { ...record, searchSuggestion: suggestion } : record
    } catch (error) {
        console.error(`Error processing ${record.slug}:`, error)
        progressBar.tick({
            slug: `❌ ${record.title} (error, indexing raw record)`,
        })
        return record
    }
}

const indexExplorerViewsMdimViewsAndChartsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return
    const indexName = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts
    )
    console.log(
        `Indexing explorer views and charts to the "${indexName}" index on Algolia`
    )
    const client = getAlgoliaClient()
    if (!client) {
        throw new Error(
            `Failed indexing explorer views (Algolia client not initialized)`
        )
    }

    // Get records and cached search suggestions
    const { records, cachedSuggestions } = await db.knexReadonlyTransaction(
        async (trx) => {
            const explorerViews = await getExplorerViewRecords(trx, true)
            const mdimViews = await getMdimViewRecords(trx)
            const grapherViews = await getChartsRecords(trx)

            // Get existing search suggestions from the database
            const cachedSuggestions = await getAllSearchSuggestions(trx)
            console.log(
                `Found ${cachedSuggestions.size} existing search suggestions in database`
            )

            // Scale grapher records and the default explorer views between 1000 and 10000,
            // Scale the remaining explorer views between 0 and 1000.
            // This is because Graphers are generally higher quality than Explorers and we don't want
            // the data catalog to smother Grapher results with hundreds of low-quality Explorer results.
            const scaledGrapherViews = scaleRecordScores(grapherViews, [
                1000,
                MAX_NON_FM_RECORD_SCORE,
            ])
            const scaledExplorerViews = scaleExplorerRecordScores(explorerViews)
            const scaledMdimViews = scaleRecordScores(mdimViews, [
                1000,
                MAX_NON_FM_RECORD_SCORE,
            ])

            const records = [
                ...scaledGrapherViews,
                ...scaledExplorerViews,
                ...scaledMdimViews,
            ]
            const featuredMetricRecords = await createFeaturedMetricRecords(
                trx,
                records
            )

            return {
                records: [...records, ...featuredMetricRecords],
                cachedSuggestions,
            }
        },
        db.TransactionCloseMode.Close
    )

    const progressBar = new ProgressBar(
        "Processing search suggestions [:bar] :current/:total :percent :etas :slug",
        {
            total: records.length,
            width: 30,
            complete: "=",
            incomplete: " ",
        }
    )

    const recordsWithSuggestions = []
    for await (const result of pMapIterable(
        records,
        (record) => processRecord(record, cachedSuggestions, progressBar),
        { concurrency: 10 }
    )) {
        recordsWithSuggestions.push(result)
    }

    const index = client.initIndex(indexName)
    console.log(`\nIndexing ${recordsWithSuggestions.length} records`)
    await index.replaceAllObjects(recordsWithSuggestions)
    console.log(`Indexing complete`)
}

indexExplorerViewsMdimViewsAndChartsToAlgolia().catch(async (e) => {
    console.error("Error in indexExplorerViewsMdimViewsAndChartsToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
