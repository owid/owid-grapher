// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import {
    getExplorerViewRecords,
    scaleExplorerRecordScores,
} from "./utils/explorerViews.js"
import {
    createFeaturedMetricRecords,
    scaleRecordScores,
} from "./utils/shared.js"
import { getChartsRecords } from "./utils/charts.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { getMdimViewRecords } from "./utils/mdimViews.js"

const indexExplorerViewsMdimViewsAndChartsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return
    const indexName = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts
    )
    console.log(
        `Indexing explorer views and charts to the "${indexName}" index on Algolia`
    )
    const client = getAlgoliaClient()
    if (!client) {
        throw new Error(
            `Failed indexing explorer views (Algolia client not initialized)`
        )
    }

    const records = await db.knexReadonlyTransaction(async (trx) => {
        const explorerViews = await getExplorerViewRecords(trx, true)
        const mdimViews = await getMdimViewRecords(trx)
        const grapherViews = await getChartsRecords(trx)
        // Scale grapher records and the default explorer views between 1000 and 10000,
        // Scale the remaining explorer views between 0 and 1000.
        // This is because Graphers are generally higher quality than Explorers and we don't want
        // the data catalog to smother Grapher results with hundreds of low-quality Explorer results.
        const scaledGrapherViews = scaleRecordScores(
            grapherViews,
            [1000, 10000]
        )
        const scaledExplorerViews = scaleExplorerRecordScores(explorerViews)
        const scaledMdimViews = scaleRecordScores(mdimViews, [1000, 10000])

        const records = [
            ...scaledGrapherViews,
            ...scaledExplorerViews,
            ...scaledMdimViews,
        ]
        const featuredMetricRecords = await createFeaturedMetricRecords(
            trx,
            records
        )

        return [...records, ...featuredMetricRecords]
    }, db.TransactionCloseMode.Close)

    const index = client.initIndex(indexName)
    console.log(`Indexing ${records.length} records`)
    await index.replaceAllObjects(records)
    console.log(`Indexing complete`)
}

indexExplorerViewsMdimViewsAndChartsToAlgolia().catch(async (e) => {
    console.error("Error in indexExplorerViewsMdimViewsAndChartsToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
