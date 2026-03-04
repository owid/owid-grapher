// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { SearchIndexName } from "@ourworldindata/types"
import { getPagesChronologicalRecords } from "./utils/pagesChronological.js"

const indexPagesChronologicalToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) {
        console.log("Algolia indexing is disabled. Exiting.")
        process.exit(0)
    }

    const client = getAlgoliaClient()
    if (!client) {
        console.error(
            "Failed indexing pages-chronological (Algolia client not initialized)"
        )
        return
    }

    const indexName = getIndexName(SearchIndexName.PagesChronological)

    const records = await db.knexReadonlyTransaction(
        getPagesChronologicalRecords,
        db.TransactionCloseMode.Close
    )

    await client.replaceAllObjects({
        indexName,
        objects: records as Array<Record<string, unknown>>,
    })

    console.log(`Indexed ${records.length} records to ${indexName}`)
    process.exit(0)
}

indexPagesChronologicalToAlgolia().catch(async (e) => {
    console.error("Error in indexPagesChronologicalToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
