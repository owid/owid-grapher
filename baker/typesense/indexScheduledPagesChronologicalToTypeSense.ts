// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import { Client } from "typesense"
import * as db from "../../db/db.js"
import { TYPESENSE_INDEXING } from "../../settings/serverSettings.js"
import { CHRONOLOGICAL_INDEX_TYPE_VALUES } from "@ourworldindata/types"
import { checkIsChronologicalGdoc } from "@ourworldindata/utils"
import { getAndLoadGdocById } from "../../db/model/Gdoc/GdocFactory.js"
import { getTypeSenseClient } from "./typesenseSearchClient.js"
import { indexIndividualGdocInChronologicalTypesense } from "./typesenseChronological.js"
import { PAGES_CHRONOLOGICAL_INDEX } from "../../site/search/searchUtils.js"

/**
 * Typesense counterpart of indexScheduledPagesChronologicalToAlgolia: indexes
 * scheduled gdocs into the pages-chronological collection once their
 * `publishedAt` has passed. Intended to be run on a schedule at the bake
 * cadence — the single-save path skips scheduled posts and the full reindex
 * excludes them, so this closes that gap.
 */
const indexScheduledPagesChronologicalToTypeSense = async () => {
    if (!TYPESENSE_INDEXING) {
        console.log("TypeSense indexing is disabled. Exiting.")
        process.exit(0)
    }

    const client = getTypeSenseClient()
    if (!client) {
        console.error(
            "Failed indexing newly-live scheduled gdocs (TypeSense client not initialized)"
        )
        return
    }

    await db.knexReadonlyTransaction(async (trx) => {
        const ids = await db.getRecentlyPublishedGdocIds(trx, [
            ...CHRONOLOGICAL_INDEX_TYPE_VALUES,
        ])
        if (!ids.length) {
            console.log("No recently-published chronological gdocs to check.")
            return
        }

        // Only index posts not already in the collection (from a previous run
        // or the save path), so we write each newly-live post once.
        const missing = await getUnindexedDocumentIds(client, ids)
        console.log(
            `${ids.length} recently-published gdocs, ${missing.length} missing from ${PAGES_CHRONOLOGICAL_INDEX}.`
        )

        for (const id of missing) {
            const gdoc = await getAndLoadGdocById(trx, id)
            if (checkIsChronologicalGdoc(gdoc)) {
                await indexIndividualGdocInChronologicalTypesense(gdoc, trx)
            }
        }
    }, db.TransactionCloseMode.Close)

    process.exit(0)
}

/** Returns the subset of `ids` that aren't yet present in the collection. */
async function getUnindexedDocumentIds(
    client: Client,
    ids: string[]
): Promise<string[]> {
    const missing: string[] = []
    for (const id of ids) {
        try {
            await client
                .collections(PAGES_CHRONOLOGICAL_INDEX)
                .documents(id)
                .retrieve()
        } catch {
            // 404 — not in the collection yet
            missing.push(id)
        }
    }
    return missing
}

indexScheduledPagesChronologicalToTypeSense().catch(async (e) => {
    console.error("Error in indexScheduledPagesChronologicalToTypeSense:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
