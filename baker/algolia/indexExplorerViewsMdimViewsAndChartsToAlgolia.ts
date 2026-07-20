// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import fs from "fs/promises"
import * as _ from "lodash-es"
import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { getExplorerViewRecords } from "./utils/explorerViews.js"
import {
    applyFMSourceBonus,
    applyFeaturedMetricBoosts,
    createFeaturedMetricRecords,
    getBoostedFeaturedMetricUrls,
    getFeaturedMetricSlugs,
    MAX_NON_FM_RECORD_SCORE,
    scaleRecordScores,
    shrinkRecordsToFitAlgoliaLimit,
} from "./utils/shared.js"
import { getChartsRecords } from "./utils/charts.js"
import { createBaseIndexingContext } from "./utils/context.js"
import { CHARTS_INDEX } from "../../site/search/searchUtils.js"
import { getMultiDimViewRecords } from "./utils/mdimViews.js"
import { getSpecialVizRecords } from "./utils/specialVizViews.js"
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
            // Create shared base context once for all record getters
            const baseContext = await createBaseIndexingContext(trx)
            const explorerViews = await getExplorerViewRecords(trx, {
                skipGrapherViews: true,
                baseContext,
            })
            const multiDimViews = await getMultiDimViewRecords(trx, {
                baseContext,
            })
            const grapherViews = await getChartsRecords(trx, {
                baseContext,
            })

            // Scale charts, mdim views, and explorer views together so scores are directly comparable.
            // Makes it easier to intuit what bonuses and boosts will do
            const scaledRecords = scaleRecordScores(
                [...explorerViews, ...multiDimViews, ...grapherViews],
                [1000, MAX_NON_FM_RECORD_SCORE]
            )

            // Increase scores slightly for the non-FM version of the records
            const fmSlugs = await getFeaturedMetricSlugs(trx)
            const bonusedRecords = applyFMSourceBonus(scaledRecords, fmSlugs)

            // Override the scores of any records that have been boosted
            const boostedUrls = await getBoostedFeaturedMetricUrls(trx)
            const records = applyFeaturedMetricBoosts(
                bonusedRecords,
                boostedUrls
            )

            const shrunkRecords = shrinkRecordsToFitAlgoliaLimit(records)
            const { records: featuredMetricRecords, failures } =
                await createFeaturedMetricRecords(trx, shrunkRecords)

            // Special viz records carry a fixed editorial score, so they're
            // added after the pageview-based score scaling
            const specialVizRecords = await getSpecialVizRecords(trx, {
                baseContext,
            })

            return {
                records: [
                    ...shrunkRecords,
                    ...specialVizRecords,
                    ...featuredMetricRecords,
                ],
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            objects: records as Array<Record<string, any>>,
        })
        console.log(`Indexing complete`)
        await reportFeaturedMetricFailuresToSlack(failures)
    }
}

indexExplorerViewsMdimViewsAndChartsToAlgolia().catch(async (e) => {
    console.error("Error in indexExplorerViewsMdimViewsAndChartsToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
