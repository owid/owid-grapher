import { ChartRecord } from "@ourworldindata/types"
import * as db from "../../../db/db.js"
import { getChartsRecords } from "./charts.js"
import { createBaseIndexingContext } from "./context.js"
import { getExplorerViewRecords } from "./explorerViews.js"
import { getMultiDimViewRecords } from "./mdimViews.js"
import {
    applyFMSourceBonus,
    applyFeaturedMetricBoosts,
    getBoostedFeaturedMetricUrls,
    getFeaturedMetricSlugs,
    MAX_NON_FM_RECORD_SCORE,
    MIN_SCALED_RECORD_SCORE,
    scaleRecordScores,
} from "./shared.js"

/**
 * Builds the scored records of the charts index (charts, explorer views and
 * multi-dim views), independent of the search engine they are sent to.
 *
 * Engine-specific steps stay with each indexer: Algolia shrinks records to its
 * size limit and adds the featured-metric (FM) copies.
 */
export async function getScoredChartIndexRecords(
    trx: db.KnexReadonlyTransaction
): Promise<ChartRecord[]> {
    // Create shared base context once for all record getters
    const baseContext = await createBaseIndexingContext(trx)
    const explorerViews = await getExplorerViewRecords(trx, {
        skipGrapherViews: true,
        baseContext,
    })
    const multiDimViews = await getMultiDimViewRecords(trx, { baseContext })
    const grapherViews = await getChartsRecords(trx, { baseContext })

    // Scale charts, mdim views, and explorer views together so scores are directly comparable.
    // Makes it easier to intuit what bonuses and boosts will do
    const scaledRecords = scaleRecordScores(
        [...explorerViews, ...multiDimViews, ...grapherViews],
        [MIN_SCALED_RECORD_SCORE, MAX_NON_FM_RECORD_SCORE]
    )

    // Increase scores slightly for the non-FM version of the records
    const fmSlugs = await getFeaturedMetricSlugs(trx)
    const bonusedRecords = applyFMSourceBonus(scaledRecords, fmSlugs)

    // Override the scores of any records that have been boosted
    const boostedUrls = await getBoostedFeaturedMetricUrls(trx)
    return applyFeaturedMetricBoosts(bonusedRecords, boostedUrls)
}
