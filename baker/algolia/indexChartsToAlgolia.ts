// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { getChartsRecords } from "./utils/charts.js"

const indexChartsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

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

indexChartsToAlgolia().catch(async (e) => {
    console.error("Error in indexChartsToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
