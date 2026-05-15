// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as _ from "lodash-es"
import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { getExplorerViewRecords } from "./utils/explorerViews.js"
import {
    applyFMSourceBonus,
    createFeaturedMetricRecords,
    getFeaturedMetricSlugs,
    MAX_NON_FM_RECORD_SCORE,
    scaleRecordScores,
    shrinkRecordsToFitAlgoliaLimit,
} from "./utils/shared.js"
import { getChartsRecords } from "./utils/charts.js"
import { createBaseIndexingContext } from "./utils/context.js"
import { CHARTS_INDEX } from "../../site/search/searchUtils.js"
import { getMdimViewRecords } from "./utils/mdimViews.js"
import { reportFeaturedMetricFailuresToSlack } from "./utils/slackReport.js"

const indexExplorerViewsMdimViewsAndChartsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) {
        console.log("ALGOLIA_INDEXING is not enabled. Skipping indexing.")
        return
    }
    const indexName = CHARTS_INDEX
    console.log(
        `Indexing explorer views and charts to the "${indexName}" index on Algolia`
    )
    const client = getAlgoliaClient()
    if (!client) {
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
            const mdimViews = await getMdimViewRecords(trx, {
                baseContext,
            })
            const grapherViews = await getChartsRecords(trx, {
                baseContext,
            })
            // Split explorer views into default (first) views and the rest.
            // Non-default explorer views are scaled to [0, 1000] to bury
            // duplicative explorer variants under higher-quality results.
            const [explorerFirstViews, explorerOtherViews] = _.partition(
                explorerViews,
                (view) => view.isFirstExplorerView
            )
            const scaledExplorerOtherViews = scaleRecordScores(
                explorerOtherViews,
                [0, 1000]
            )

            // Scale charts, mdim views, and default explorer views together
            // in a single pool so scores are directly comparable.
            const scaledPrimaryRecords = scaleRecordScores(
                [...grapherViews, ...mdimViews, ...explorerFirstViews],
                [1000, MAX_NON_FM_RECORD_SCORE]
            )

            const scaledRecords = [
                ...scaledPrimaryRecords,
                ...scaledExplorerOtherViews,
            ]

            // Apply post-scaling adjustments. FM source bonus is a fixed
            // +500 to any record whose specific view is a featured metric.
            // boostInSearch overrides the score to 9500 for editorially
            // pinned records. Order matters: boostInSearch should override
            // the FM source bonus.
            const fmSlugs = await getFeaturedMetricSlugs(trx)
            const bonusedRecords = applyFMSourceBonus(scaledRecords, fmSlugs)

            const shrunkRecords = shrinkRecordsToFitAlgoliaLimit(bonusedRecords)
            const { records: featuredMetricRecords, failures } =
                await createFeaturedMetricRecords(trx, shrunkRecords)

            return {
                records: [...shrunkRecords, ...featuredMetricRecords],
                failures,
            }
        },
        db.TransactionCloseMode.Close
    )

    console.log(`Indexing ${records.length} records`)
    await client.replaceAllObjects({
        indexName,
        objects: records as Array<Record<string, any>>,
    })
    console.log(`Indexing complete`)

    await reportFeaturedMetricFailuresToSlack(failures)
}

indexExplorerViewsMdimViewsAndChartsToAlgolia().catch(async (e) => {
    console.error("Error in indexExplorerViewsMdimViewsAndChartsToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
