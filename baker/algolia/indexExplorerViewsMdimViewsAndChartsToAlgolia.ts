// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import {
    getExplorerViewRecords,
    adaptExplorerViews,
} from "./utils/explorerViews.js"
import { scaleRecordScores } from "./utils/shared.js"
import { getIndexName } from "../../site/search/searchClient.js"
import {
    SearchIndexName,
    ChartRecordType,
    ChartRecord,
} from "../../site/search/searchTypes.js"
import { extractSearchSuggestions } from "./extractSearchSuggestions.js"
import { pMapIterable } from "p-map"
import ProgressBar from "progress"

// Configure the model to use for search suggestions
const OLLAMA_MODEL = "llama3.2-vision"

/**
 * Generate a thumbnail URL for a chart or explorer view
 */
function createChartThumbnailUrl(record: ChartRecord): string {
    const isExplorerView = record.type === ChartRecordType.ExplorerView
    const queryParams = record.queryParams || ""
    return isExplorerView
        ? `/explorers/${record.slug}.png${queryParams}`
        : `/grapher/${record.slug}.png${queryParams}`
}

/**
 * Get existing search suggestions from the database
 */
async function getAllSearchSuggestions(
    knex: db.KnexReadonlyTransaction
): Promise<{ imageUrl: string; suggestions: string[] }[]> {
    const rows = await db.knexRaw<{ imageUrl: string; suggestions: string }>(
        knex,
        `-- sql
        SELECT imageUrl, suggestions
        FROM search_suggestions
        WHERE suggestions IS NOT NULL
        `
    )

    return rows.map((row) => ({
        imageUrl: row.imageUrl,
        suggestions: JSON.parse(row.suggestions),
    }))
}

/**
 * Store search suggestions in the database
 */
async function storeSearchSuggestions(
    imageUrl: string,
    suggestions: string[]
): Promise<void> {
    // If there are no valid suggestions, don't insert anything
    if (suggestions.length === 0) return

    // Store suggestions as a JSON array
    const suggestionsJson = JSON.stringify(suggestions)

    await db
        .knexInstance()
        .table("search_suggestions")
        .insert({
            imageUrl,
            suggestions: suggestionsJson,
        })
        .onConflict("imageUrl")
        .merge()
}

// We get 200k operations with Algolia's Open Source plan. We've hit 140k in the past so this might push us over.
// If we standardize the record shape, we could have this be the only index and have a `type` field
// to use in /search.
const indexExplorerViewsMdimViewsAndChartsToAlgolia = async () => {
    // if (!ALGOLIA_INDEXING) return
    const indexName = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts
    )
    console.log(
        `Indexing explorer views and charts to the "${indexName}" index on Algolia`
    )
    // const client = getAlgoliaClient()
    // if (!client) {
    //     throw new Error(
    //         `Failed indexing explorer views (Algolia client not initialized)`
    //     )
    // }

    const { explorerViews, mdimViews, grapherViews, allSearchSuggestions } =
        await db.knexReadonlyTransaction(async (trx) => {
            return {
                explorerViews: await getExplorerViewRecords(trx, true),
                mdimViews: [], //await getMdimViewRecords(trx),
                grapherViews: [], //await getChartsRecords(trx),
                allSearchSuggestions: await getAllSearchSuggestions(trx),
            }
        }, db.TransactionCloseMode.Close)

    console.log(
        `Found ${allSearchSuggestions.length} existing search suggestions in database`
    )

    // Scale grapher records and the default explorer views between 1000 and 10000,
    // Scale the remaining explorer views between 0 and 1000.
    // This is because Graphers are generally higher quality than Explorers and we don't want
    // the data catalog to smother Grapher results with hundreds of low-quality Explorer results.
    const scaledGrapherViews = scaleRecordScores(grapherViews, [1000, 10000])
    const scaledExplorerViews = adaptExplorerViews(explorerViews)
    const scaledMdimViews = scaleRecordScores(mdimViews, [1000, 10000])

    const records = [
        ...scaledGrapherViews,
        ...scaledExplorerViews,
        ...scaledMdimViews,
    ]

    // Create a progress bar
    const progressBar = new ProgressBar(
        "Add search suggestions [:bar] :current/:total :percent :etas :slug\n",
        {
            total: records.length,
            width: 30,
            complete: "=",
            incomplete: " ",
        }
    )

    // Process each record to extract search suggestions if none have been
    // stored in the database yet. Otherwise, use the existing suggestions from
    // the database.
    const recordsWithSearchSuggestions = []

    for await (const result of pMapIterable(
        records,
        async (record: ChartRecord) => {
            try {
                // Generate thumbnail URL based on record type
                const thumbnailUrl = createChartThumbnailUrl(record)

                // Check if we already have search suggestions for this thumbnail
                const existingSuggestions = allSearchSuggestions.find(
                    (suggestion) => suggestion.imageUrl === thumbnailUrl
                )
                let searchSuggestions: string[] = []

                if (existingSuggestions) {
                    // Use existing suggestions from database
                    searchSuggestions = existingSuggestions.suggestions
                    progressBar.tick({ slug: `${record.slug} (cached)` })
                } else {
                    // Extract search suggestions from the thumbnail
                    searchSuggestions = await extractSearchSuggestions(
                        OLLAMA_MODEL,
                        `https://ourworldindata.org${thumbnailUrl}`
                    )

                    // Store the new suggestions in the database
                    await storeSearchSuggestions(
                        thumbnailUrl,
                        searchSuggestions
                    )

                    progressBar.tick({ slug: record.slug })
                }

                // Add search suggestions to the record
                return {
                    ...record,
                    searchSuggestions,
                }
            } catch (error) {
                console.error(
                    `Failed to extract suggestions for ${record.slug}:`,
                    error
                )
                // Update progress bar even on error
                progressBar.tick({ slug: `${record.slug} (error)` })
                // Return the original record if we couldn't extract suggestions
                return record
            }
        },
        { concurrency: 2 }
    )) {
        recordsWithSearchSuggestions.push(result)
    }

    // const index = client.initIndex(indexName)

    // await index.replaceAllObjects(processedRecords)
    console.log(`\nIndexed ${recordsWithSearchSuggestions.length} records`)
    console.log(`Indexing complete`)
}

indexExplorerViewsMdimViewsAndChartsToAlgolia().catch(async (e) => {
    console.error("Error in indexExplorerViewsMdimViewsAndChartsToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
