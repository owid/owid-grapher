// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { PAGES_INDEX } from "../../site/search/searchUtils.js"
import { getPagesRecords } from "./utils/pages.js"
import { ensureRecordFitsAlgoliaLimit } from "./utils/shared.js"
import { partition } from "remeda"
import { logErrorAndMaybeCaptureInSentry } from "../../serverUtils/errorLog.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { SearchIndexName } from "@ourworldindata/types"

const indexPagesToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) {
        console.log("Algolia indexing is disabled. Exiting.")
        process.exit(0)
    }

    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed indexing pages (Algolia client not initialized)`)
        return
    }
    const indexName = PAGES_INDEX

    const records = await db.knexReadonlyTransaction(
        getPagesRecords,
        db.TransactionCloseMode.Close
    )
    const [fittedRecords, unfittedRecords] = partition(
        records,
        ensureRecordFitsAlgoliaLimit
    )
    if (unfittedRecords.length > 0) {
        await logErrorAndMaybeCaptureInSentry(
            `${getIndexName(SearchIndexName.Pages)}: ${unfittedRecords.length} records exceed Algolia size limit and will not be indexed.
ObjectIDs: ${unfittedRecords.map((r) => r.objectID).join(", ")}`
        )
    }

    await client.replaceAllObjects({
        indexName,
        objects: fittedRecords as Array<Record<string, any>>,
    })

    process.exit(0)
}

indexPagesToAlgolia().catch(async (e) => {
    console.error("Error in indexPagesToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
