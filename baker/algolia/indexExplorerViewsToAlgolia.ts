import * as db from "../../db/db.js"
import {
    ALGOLIA_INDEXING,
    BUGSNAG_NODE_API_KEY,
} from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import Bugsnag from "@bugsnag/js"
import { logErrorAndMaybeSendToBugsnag } from "../../serverUtils/errorLog.js"
import { getExplorerViewRecords } from "./utils/explorerViews.js"

const indexExplorerViewsToAlgolia = async () => {
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
        await logErrorAndMaybeSendToBugsnag(
            `Failed indexing explorer views (Algolia client not initialized)`
        )
        return
    }

    try {
        const index = client.initIndex(
            getIndexName(SearchIndexName.ExplorerViews)
        )

        const records = await db.knexReadonlyTransaction(
            getExplorerViewRecords,
            db.TransactionCloseMode.Close
        )
        console.log(`Indexing ${records.length} explorer views to Algolia`)
        await index.replaceAllObjects(records)
        console.log(`Indexing complete`)
    } catch (e) {
        console.error(e)
        await logErrorAndMaybeSendToBugsnag({
            name: `IndexExplorerViewsToAlgoliaError`,
            message: `${e}`,
        })
    }
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

void indexExplorerViewsToAlgolia()
