import fs from "fs/promises"
import Bugsnag from "@bugsnag/js"
import * as db from "../../db/db.js"
import { logErrorAndMaybeSendToBugsnag } from "../../serverUtils/errorLog.js"
import {
    ALGOLIA_INDEXING,
    BUGSNAG_NODE_API_KEY,
} from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { ExplorerViewEntryWithExplorerInfo } from "./utils/types.js"
import { getExplorerViewRecords } from "./utils/explorerViews.js"
import { getChartsRecords } from "./utils/charts.js"
import { getIndexName } from "../../site/search/searchClient.js"
import {
    ChartRecord,
    ChartRecordType,
    SearchIndexName,
} from "../../site/search/searchTypes.js"

function explorerViewRecordToChartRecord(
    e: ExplorerViewEntryWithExplorerInfo
): ChartRecord {
    return {
        type: ChartRecordType.ExplorerView,
        objectID: e.objectID!,
        chartId: Math.floor(Math.random() * 1000000),
        slug: e.explorerSlug,
        queryParams: e.viewQueryParams,
        title: e.viewTitle,
        subtitle: e.explorerSubtitle,
        variantName: "",
        keyChartForTags: [],
        tags: e.tags,
        availableEntities: e.availableEntities,
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        numDimensions: e.numNonDefaultSettings,
        titleLength: e.titleLength,
        numRelatedArticles: 0,
        views_7d: e.explorerViews_7d,
        score: e.score,
    }
}

/**
 * Scale explorer scores to the range of grapher scores
 * e.g. if the highest explorer score is 100 and the highest grapher score is 1000,
 * we want to scale the explorer scores to be between 0 and 1000
 */
function scaleExplorerScores(
    explorerRecords: ChartRecord[],
    grapherRecords: ChartRecord[]
): ChartRecord[] {
    const explorerScores = explorerRecords.map((e) => e.score)
    const explorerScoreMax = Math.max(...explorerScores)

    const grapherScores = grapherRecords.map((e) => e.score)
    const grapherScoreBounds = {
        max: Math.max(...grapherScores),
        min: Math.min(...grapherScores),
    }

    // scale positive explorer scores to the range of grapher scores
    // We want to keep negative scores because they're intentionally downranked as near-duplicates of existing views
    return explorerRecords.map((e): ChartRecord => {
        if (e.score < 0) return e
        // A value between 0 and 1
        const normalized = e.score / explorerScoreMax
        const grapherRange = grapherScoreBounds.max - grapherScoreBounds.min
        const scaled = Math.round(
            (normalized / 2) * grapherRange + grapherScoreBounds.min
        )
        return {
            ...e,
            score: scaled,
        }
    })
}

// We get 200k operations with Algolia's Open Source plan. We've hit 140k in the past so this might push us over.
// If we standardize the record shape, we could have this be the only index and have a `type` field
// to use in /search.
const indexExplorerViewsAndChartsToAlgolia = async () => {
    const indexName = getIndexName(SearchIndexName.ExplorerViewsAndCharts)
    console.log(
        `Indexing explorer views and charts to the "${indexName}" index on Algolia`
    )
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
        const { explorerViews, grapherViews } =
            await db.knexReadonlyTransaction(async (trx) => {
                return {
                    explorerViews: await getExplorerViewRecords(trx),
                    grapherViews: await getChartsRecords(trx),
                }
            }, db.TransactionCloseMode.Close)

        const convertedExplorerViews = explorerViews.map(
            explorerViewRecordToChartRecord
        )
        const scaledExplorerViews = scaleExplorerScores(
            convertedExplorerViews,
            grapherViews
        )
        const records = [...scaledExplorerViews, ...grapherViews]

        const index = client.initIndex(indexName)
        console.log(`Indexing ${records.length} records`)
        await index.replaceAllObjects(records)
        console.log(`Indexing complete`)
    } catch (e) {
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

void indexExplorerViewsAndChartsToAlgolia()
