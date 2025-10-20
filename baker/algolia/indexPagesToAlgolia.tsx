// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { getPagesRecords } from "./utils/pages.js"

const indexPagesToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed indexing pages (Algolia client not initialized)`)
        return
    }
    const indexName = getIndexName(SearchIndexName.Pages)

    const records = await db.knexReadonlyTransaction(
        getPagesRecords,
        db.TransactionCloseMode.Close
    )

    await client.replaceAllObjects({
        indexName,
        objects: records as Array<Record<string, any>>,
    })

    process.exit(0)
}

indexPagesToAlgolia().catch(async (e) => {
    console.error("Error in indexPagesToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
