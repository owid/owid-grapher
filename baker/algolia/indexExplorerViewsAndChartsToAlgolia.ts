import Bugsnag from "@bugsnag/js"
import * as db from "../../db/db.js"
import { logErrorAndMaybeSendToBugsnag } from "../../serverUtils/errorLog.js"
import {
    ALGOLIA_INDEXING,
    BUGSNAG_NODE_API_KEY,
} from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import {
    getExplorerViewRecords,
    adaptExplorerViews,
} from "./utils/explorerViews.js"
import { scaleRecordScores } from "./utils/shared.js"
import { getChartsRecords } from "./utils/charts.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"

// We get 200k operations with Algolia's Open Source plan. We've hit 140k in the past so this might push us over.
// If we standardize the record shape, we could have this be the only index and have a `type` field
// to use in /search.
const indexExplorerViewsAndChartsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return
    if (BUGSNAG_NODE_API_KEY) {
        Bugsnag.start({
            apiKey: BUGSNAG_NODE_API_KEY,
            context: "index-explorer-views-to-algolia",
            autoTrackSessions: false,
        })
    }
    const indexName = getIndexName(SearchIndexName.ExplorerViewsAndCharts)
    console.log(
        `Indexing explorer views and charts to the "${indexName}" index on Algolia`
    )
    const client = getAlgoliaClient()
    if (!client) {
        await logErrorAndMaybeSendToBugsnag(
            `Failed indexing explorer views (Algolia client not initialized)`
        )
        return
    }

    try {
        const { explorerViews, grapherViews } =
            await db.knexReadonlyTransaction(async (trx) => {
                return {
                    explorerViews: await getExplorerViewRecords(trx, true),
                    grapherViews: await getChartsRecords(trx),
                }
            }, db.TransactionCloseMode.Close)

        // Scale grapher records and the default explorer views between 1000 and 10000,
        // Scale the remaining explorer views between 0 and 1000.
        // This is because Graphers are generally higher quality than Explorers and we don't want
        // the data catalog to smother Grapher results with hundreds of low-quality Explorer results.
        const scaledGrapherViews = scaleRecordScores(
            grapherViews,
            [1000, 10000]
        )
        const scaledExplorerViews = adaptExplorerViews(explorerViews)

        const records = [...scaledGrapherViews, ...scaledExplorerViews]

        const index = client.initIndex(indexName)
        console.log(`Indexing ${records.length} records`)
        await index.replaceAllObjects(records)
        console.log(`Indexing complete`)
    } catch (error) {
        console.log("Error: ", error)
        await logErrorAndMaybeSendToBugsnag({
            name: `IndexExplorerViewsToAlgoliaError`,
            message: error,
        })
    }
}

process.on("unhandledRejection", (e) => {
    console.error(e)
    process.exit(1)
})

void indexExplorerViewsAndChartsToAlgolia()
