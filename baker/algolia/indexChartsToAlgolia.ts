import * as db from "../../db/db.js"
import {
    ALGOLIA_INDEXING,
    BUGSNAG_NODE_API_KEY,
} from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { getChartsRecords } from "./utils/charts.js"
import Bugsnag from "@bugsnag/js"

const indexChartsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return
    if (BUGSNAG_NODE_API_KEY) {
        Bugsnag.start({
            apiKey: BUGSNAG_NODE_API_KEY,
            context: "index-explorer-views-to-algolia",
            autoTrackSessions: false,
        })
    }

    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed indexing charts (Algolia client not initialized)`)
        return
    }

    const index = client.initIndex(getIndexName(SearchIndexName.Charts))

    const records = await db.knexReadonlyTransaction(
        getChartsRecords,
        db.TransactionCloseMode.Close
    )
    await index.replaceAllObjects(records)
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

void indexChartsToAlgolia()
