// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { TYPESENSE_INDEXING } from "../../settings/serverSettings.js"
import ProgressBar from "progress"
import { getTypeSenseClient } from "./typesenseSearchClient.js"
import {
    createCacheTable,
    saveRecordsToCache,
    loadRecordsFromCache,
    checkTableExistsAndNotEmpty,
    recreateCollection,
} from "./typesenseCacheTable.js"
import {
    getExplorerViewRecords,
    scaleExplorerRecordScores,
} from "../algolia/utils/explorerViews.js"
import {
    createFeaturedMetricRecords,
    MAX_NON_FM_RECORD_SCORE,
    scaleRecordScores,
} from "../algolia/utils/shared.js"
import { getChartsRecords } from "../algolia/utils/charts.js"
import { getMdimViewRecords } from "../algolia/utils/mdimViews.js"
import { convertDateToUnixTimestamp } from "./indexPagesToTypeSense.js"
import { chartsCollectionSchema } from "./typesenseCollectionSchemas.js"
import { CHARTS_INDEX } from "../../site/search/searchUtils.js"
import { ChartRecord } from "@ourworldindata/types"

const indexExplorerViewsMdimViewsAndChartsToTypeSense = async () => {
    if (!TYPESENSE_INDEXING) return

    const collectionName = CHARTS_INDEX

    const cacheTableName = "search_records_charts"

    const client = getTypeSenseClient()
    if (!client) {
        throw new Error(
            `Failed indexing explorer views (TypeSense client not initialized)`
        )
    }

    let records: ChartRecord[]

    // Check if cache table exists and use cached records if available
    const cacheExists = await checkTableExistsAndNotEmpty(cacheTableName)
    if (cacheExists) {
        try {
            records = await loadRecordsFromCache<ChartRecord>(cacheTableName)
            console.log(`Using cached records from ${cacheTableName}`)
        } catch {
            console.log(
                `Failed to load cached records, generating fresh data...`
            )
            records = await generateRecords()
        }
    } else {
        console.log(
            `Cache table ${cacheTableName} doesn't exist, generating fresh data...`
        )
        records = await generateRecords()

        // Create cache table and save records
        await createCacheTable(cacheTableName)
        await saveRecordsToCache(cacheTableName, records)
    }
    console.log(
        `Indexing explorer views and charts to TypeSense collection: ${collectionName}`
    )
    // Create or update the TypeSense collection
    await recreateCollection(client, chartsCollectionSchema, collectionName)

    // Transform records: objectID -> id (TypeSense uses 'id' instead of 'objectID')
    // and convert date strings to Unix timestamps.
    // Preserve the original Algolia `id` field (e.g. "grapher/slug" or
    // "explorer/slug?params") as `deduplicationId` so we can use it with
    // Typesense's `group_by` for deduplication (equivalent to Algolia's
    // `distinct` on `attributeForDistinct: "id"`).
    const typeSenseRecords = records.map((record) => ({
        ...record,
        deduplicationId: record.id,
        id: record.objectID,
        objectID: undefined, // Remove the objectID field
        publishedAt: convertDateToUnixTimestamp(record.publishedAt),
        updatedAt: convertDateToUnixTimestamp(record.updatedAt),
    }))

    console.log(`Indexing ${typeSenseRecords.length} records to TypeSense`)

    // Create progress bar for indexing
    const progressBar = new ProgressBar(
        "Indexing charts [:bar] :current/:total :percent :elapseds :name",
        {
            total: typeSenseRecords.length,
            width: 40,
            renderThrottle: 100,
        }
    )

    try {
        // Import documents in batches to avoid timeouts and track progress
        const batchSize = 100
        const batches = []
        for (let i = 0; i < typeSenseRecords.length; i += batchSize) {
            batches.push(typeSenseRecords.slice(i, i + batchSize))
        }

        const importResults = []

        for (const [index, batch] of batches.entries()) {
            const batchResult = await client
                .collections(collectionName)
                .documents()
                .import(batch, {
                    action: "create",
                })

            importResults.push(batchResult)
            progressBar.tick(batch.length, {
                name: `Batch ${index + 1}/${batches.length}`,
            })
        }

        console.log(`\nTypeSense explorer/charts indexing complete`)
        console.log(`Import results:`, importResults)
    } catch (error: any) {
        // Handle partial import errors gracefully
        if (error.name === "ImportError") {
            const successCount = error.payload?.successCount || 0
            const failedCount = error.payload?.failedItems?.length || 0
            console.log(
                `TypeSense explorer/charts indexing completed with some failures:`
            )
            console.log(`✓ Successfully imported: ${successCount} documents`)
            console.log(`✗ Failed to import: ${failedCount} documents`)

            // Show a few failed items for debugging
            if (
                error.payload?.failedItems &&
                error.payload.failedItems.length > 0
            ) {
                console.log(`\nFirst few failed items:`)
                error.payload.failedItems
                    .slice(0, 3)
                    .forEach((item: any, index: number) => {
                        console.log(
                            `${index + 1}. Error: ${item.error || "Unknown error"}`
                        )
                        if (item.document && item.document.id) {
                            console.log(`   Document ID: ${item.document.id}`)
                        }
                    })
            }
        } else {
            console.error("Error indexing explorer/charts to TypeSense:", error)
            throw error
        }
    }

    console.log("TypeSense explorer/charts indexing completed successfully!")
}

// Helper function to generate records from database
const generateRecords = async () => {
    return db.knexReadonlyTransaction(async (trx) => {
        const explorerViews = await getExplorerViewRecords(trx, {
            skipGrapherViews: true,
        })
        const mdimViews = await getMdimViewRecords(trx)
        const grapherViews = await getChartsRecords(trx)

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
        const { records: featuredMetricRecords } =
            await createFeaturedMetricRecords(trx, records)

        return [...records, ...featuredMetricRecords]
    }, db.TransactionCloseMode.Close)
}

// If this file is run directly, execute the indexing
if (require.main === module) {
    void indexExplorerViewsMdimViewsAndChartsToTypeSense().catch(async (e) => {
        console.error(
            "Error in indexExplorerViewsMdimViewsAndChartsToTypeSense:",
            e
        )
        Sentry.captureException(e)
        await Sentry.close()
        process.exit(1)
    })
}
