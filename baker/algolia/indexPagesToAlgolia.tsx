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
    const index = client.initIndex(getIndexName(SearchIndexName.Pages))

    const records = await db.knexReadonlyTransaction(
        getPagesRecords,
        db.TransactionCloseMode.Close
    )

    await index.replaceAllObjects(records)

    process.exit(0)
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

void indexPagesToAlgolia()
