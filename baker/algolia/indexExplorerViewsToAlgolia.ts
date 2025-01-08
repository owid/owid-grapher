// This must be imported first for Sentry instrumentation to work.
import "../../serverUtils/instrument.js"

import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { getExplorerViewRecords } from "./utils/explorerViews.js"

const indexExplorerViewsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return
    const client = getAlgoliaClient()

    if (!client) {
        throw new Error(
            `Failed indexing explorer views (Algolia client not initialized)`
        )
    }

    const index = client.initIndex(getIndexName(SearchIndexName.ExplorerViews))

    const records = await db.knexReadonlyTransaction(
        getExplorerViewRecords,
        db.TransactionCloseMode.Close
    )
    console.log(`Indexing ${records.length} explorer views to Algolia`)
    await index.replaceAllObjects(records)
    console.log(`Indexing complete`)
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

void indexExplorerViewsToAlgolia()
