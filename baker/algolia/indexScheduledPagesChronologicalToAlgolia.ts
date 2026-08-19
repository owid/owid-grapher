// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import { SearchClient } from "algoliasearch"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { getIndexName } from "../../site/search/searchClient.js"
import {
    CHRONOLOGICAL_INDEX_TYPE_VALUES,
    SearchIndexName,
} from "@ourworldindata/types"
import { checkIsChronologicalGdoc } from "@ourworldindata/utils"
import { getAndLoadGdocById } from "../../db/model/Gdoc/GdocFactory.js"
import { indexIndividualGdocInChronological } from "./utils/pagesChronological.js"

/**
 * Indexes scheduled gdocs into the pages-chronological index once their
 * `publishedAt` has passed. Intended to be run on a schedule (e.g. a Buildkite
 * cron) at the bake cadence.
 *
 * The single-save path skips scheduled posts and the weekly full reindex
 * excludes them, so this closes that gap by indexing recently-live posts that
 * aren't in the index yet.
 *
 * Scoped to the chronological index for now. The regular pages index has the
 * same gap for scheduled posts and the same approach would apply there — it
 * just hasn't been wired up yet, so it keeps its weekly-batch behavior.
 */
const indexScheduledPagesChronologicalToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) {
        console.log("Algolia indexing is disabled. Exiting.")
        process.exit(0)
    }

    const client = getAlgoliaClient()
    if (!client) {
        console.error(
            "Failed indexing newly-live scheduled gdocs (Algolia client not initialized)"
        )
        return
    }

    const indexName = getIndexName(SearchIndexName.PagesChronological)

    await db.knexReadonlyTransaction(async (trx) => {
        const ids = await db.getRecentlyPublishedGdocIds(trx, [
            ...CHRONOLOGICAL_INDEX_TYPE_VALUES,
        ])
        if (!ids.length) {
            console.log("No recently-published chronological gdocs to check.")
            return
        }

        // Only index posts not already in the index (from a previous run or
        // the save path), so we write each newly-live post once.
        const missing = await getUnindexedObjectIds(client, indexName, ids)
        console.log(
            `${ids.length} recently-published gdocs, ${missing.length} missing from ${indexName}.`
        )

        for (const id of missing) {
            const gdoc = await getAndLoadGdocById(trx, id)
            if (checkIsChronologicalGdoc(gdoc)) {
                await indexIndividualGdocInChronological(gdoc, trx)
            }
        }
    }, db.TransactionCloseMode.Close)

    process.exit(0)
}

/** Returns the subset of `objectIDs` that aren't yet present in `indexName`. */
async function getUnindexedObjectIds(
    client: SearchClient,
    indexName: string,
    objectIDs: string[]
): Promise<string[]> {
    if (!objectIDs.length) return []
    const { results } = await client.getObjects<{ objectID: string } | null>({
        requests: objectIDs.map((objectID) => ({
            indexName,
            objectID,
            attributesToRetrieve: ["objectID"],
        })),
    })
    // `results` is aligned positionally with the requests; a null means the
    // object isn't in the index.
    return objectIDs.filter((_, i) => results[i] === null)
}

indexScheduledPagesChronologicalToAlgolia().catch(async (e) => {
    console.error("Error in indexScheduledPagesChronologicalToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
