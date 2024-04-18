import * as db from "../../db/db.js"
import * as wpdb from "../../db/wpdb.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { getPagesRecords } from "./algoliaUtils.js"

const indexToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed indexing pages (Algolia client not initialized)`)
        return
    }
    const index = client.initIndex(getIndexName(SearchIndexName.Pages))

    // TODO: this transaction is only RW because somewhere inside it we fetch images
    const records = await db.knexReadWriteTransaction(
        getPagesRecords,
        db.TransactionCloseMode.Close
    )

    await index.replaceAllObjects(records)

    await wpdb.singleton.end()
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

void indexToAlgolia()
