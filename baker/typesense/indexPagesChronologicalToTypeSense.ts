// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { TYPESENSE_INDEXING } from "../../settings/serverSettings.js"
import { getTypeSenseClient } from "./typesenseSearchClient.js"
import { recreateCollection } from "./typesenseCacheTable.js"
import { getPagesChronologicalRecords } from "../algolia/utils/pagesChronological.js"
import {
    pagesChronologicalCollectionSchema,
    toTypesenseChronologicalRecord,
} from "./typesenseChronological.js"
import { PAGES_CHRONOLOGICAL_INDEX } from "../../site/search/searchUtils.js"

const indexPagesChronologicalToTypeSense = async () => {
    if (!TYPESENSE_INDEXING) {
        console.log("TypeSense indexing is disabled. Exiting.")
        process.exit(0)
    }

    const client = getTypeSenseClient()
    if (!client) {
        throw new Error(
            "Failed indexing pages-chronological (TypeSense client not initialized)"
        )
    }

    const collectionName = PAGES_CHRONOLOGICAL_INDEX

    const records = await db.knexReadonlyTransaction(
        getPagesChronologicalRecords,
        db.TransactionCloseMode.Close
    )

    await recreateCollection(
        client,
        pagesChronologicalCollectionSchema,
        collectionName
    )

    const typeSenseRecords = records.map(toTypesenseChronologicalRecord)

    // Unlike the pages/charts records these carry whole enriched-block
    // payloads, so keep batches small to stay well under request size limits.
    const batchSize = 50
    for (let i = 0; i < typeSenseRecords.length; i += batchSize) {
        await client
            .collections(collectionName)
            .documents()
            .import(typeSenseRecords.slice(i, i + batchSize), {
                action: "create",
            })
    }

    console.log(`Indexed ${records.length} records to ${collectionName}`)
    process.exit(0)
}

indexPagesChronologicalToTypeSense().catch(async (e) => {
    console.error("Error in indexPagesChronologicalToTypeSense:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
