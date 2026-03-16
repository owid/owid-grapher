// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { TYPESENSE_INDEXING } from "../../settings/serverSettings.js"
import ProgressBar from "progress"
import { getTypeSenseClient } from "./typesenseSearchClient.js"
import {
    checkTableExistsAndNotEmpty,
    createCacheTable,
    saveRecordsToCache,
    loadRecordsFromCache,
    recreateCollection,
} from "./typesenseCacheTable.js"
import { getPagesRecords } from "../algolia/utils/pages.js"
import { PAGES_INDEX } from "../../site/search/searchUtils.js"
import { pagesCollectionSchema } from "./typesenseCollectionSchemas.js"
import { PageRecord } from "@ourworldindata/types"

const indexPagesToTypeSense = async () => {
    if (!TYPESENSE_INDEXING) return

    const client = getTypeSenseClient()
    if (!client) {
        console.error(
            `Failed indexing pages (TypeSense client not initialized)`
        )
        return
    }

    const collectionName = PAGES_INDEX
    const cacheTableName = "search_records_pages"

    let records: PageRecord[]

    // Check if cache table exists and use cached records if available
    const cacheExists = await checkTableExistsAndNotEmpty(cacheTableName)
    if (cacheExists) {
        try {
            records = await loadRecordsFromCache<PageRecord>(cacheTableName)
            console.log(`Using cached records from ${cacheTableName}`)
        } catch (error) {
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

    console.log(`Indexing pages to TypeSense collection: ${collectionName}`)

    // Create or update the TypeSense collection
    await recreateCollection(client, pagesCollectionSchema, collectionName)

    // Transform records: objectID -> id (TypeSense uses 'id' instead of 'objectID')
    // and convert date strings to Unix timestamps
    const typeSenseRecords = records.map((record) => ({
        ...record,
        id: record.objectID,
        objectID: undefined, // Remove the objectID field
        date: convertDateToUnixTimestamp(record.date),
        modifiedDate: convertDateToUnixTimestamp(record.modifiedDate),
    }))

    console.log(`Indexing ${typeSenseRecords.length} records to TypeSense`)

    // Create progress bar for indexing
    const progressBar = new ProgressBar(
        "Indexing pages [:bar] :current/:total :percent :elapseds :name",
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

        console.log(`\nTypeSense pages indexing complete`)
        console.log(`Import results:`, importResults)
    } catch (error: any) {
        // Handle partial import errors gracefully
        if (error.name === "ImportError") {
            const successCount = error.payload?.successCount || 0
            const failedCount = error.payload?.failedItems?.length || 0
            console.log(
                `TypeSense pages indexing completed with some failures:`
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
            console.error("Error indexing pages to TypeSense:", error)
            throw error
        }
    }

    console.log("TypeSense pages indexing completed successfully!")
}

// Helper function to generate records from database
const generateRecords = async () => {
    return db.knexReadonlyTransaction(
        getPagesRecords,
        db.TransactionCloseMode.Close
    )
}

export const convertDateToUnixTimestamp = (
    dateString: string | null | undefined
): number | undefined => {
    if (!dateString) return undefined
    try {
        const date = new Date(dateString)
        return isNaN(date.getTime())
            ? undefined
            : Math.floor(date.getTime() / 1000)
    } catch {
        return undefined
    }
}

// If this file is run directly, execute the indexing
if (require.main === module) {
    void indexPagesToTypeSense().catch(async (e) => {
        console.error("Error in indexPagesToTypeSense:", e)
        Sentry.captureException(e)
        await Sentry.close()
        process.exit(1)
    })
}
