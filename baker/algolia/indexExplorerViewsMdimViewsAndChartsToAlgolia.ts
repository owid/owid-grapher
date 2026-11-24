// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import fs from "fs/promises"
import * as _ from "lodash-es"
import { runSentryScript } from "../../serverUtils/sentryTracing.js"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import {
    createFeaturedMetricRecords,
    shrinkRecordsToFitAlgoliaLimit,
} from "./utils/shared.js"
import { getScoredChartIndexRecords } from "./utils/chartIndexRecords.js"
import { CHARTS_INDEX } from "../../site/search/searchUtils.js"
import { reportFeaturedMetricFailuresToSlack } from "./utils/slackReport.js"

const indexExplorerViewsMdimViewsAndChartsToAlgolia = async () => {
    const dryRun = process.argv.includes("--dry-run")

    if (!dryRun && !ALGOLIA_INDEXING) {
        console.log("ALGOLIA_INDEXING is not enabled. Skipping indexing.")
        return
    }
    const indexName = CHARTS_INDEX
    const dryRunOutput = `tmp/${indexName}.json`
    if (dryRun) {
        console.log(`Dry run: building records and writing to ${dryRunOutput}`)
    } else {
        console.log(
            `Indexing explorer views and charts to the "${indexName}" index on Algolia`
        )
    }
    const client = dryRun ? null : getAlgoliaClient()
    if (!dryRun && !client) {
        throw new Error(
            `Failed indexing explorer views (Algolia client not initialized)`
        )
    }

    const { records, failures } = await db.knexReadonlyTransaction(
        async (trx) => {
            const records = await getScoredChartIndexRecords(trx)
            const shrunkRecords = shrinkRecordsToFitAlgoliaLimit(records)
            const { records: featuredMetricRecords, failures } =
                await createFeaturedMetricRecords(trx, shrunkRecords)

            return {
                records: [...shrunkRecords, ...featuredMetricRecords],
                failures,
            }
        },
        db.TransactionCloseMode.Close
    )

    if (dryRun) {
        await fs.mkdir("tmp", { recursive: true })
        await fs.writeFile(dryRunOutput, JSON.stringify(records, null, 2))
        console.log(`Wrote ${records.length} records to ${dryRunOutput}`)
    } else {
        console.log(`Indexing ${records.length} records`)
        await client!.replaceAllObjects({
            indexName,
            objects: records as Array<Record<string, any>>,
        })
        console.log(`Indexing complete`)
        await reportFeaturedMetricFailuresToSlack(failures)
    }
}

void runSentryScript(
    "indexExplorerViewsMdimViewsAndChartsToAlgolia",
    indexExplorerViewsMdimViewsAndChartsToAlgolia
)
