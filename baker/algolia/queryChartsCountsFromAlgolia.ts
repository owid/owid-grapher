// filepath: /home/owid/owid-grapher/baker/algolia/queryChartsCountsFromAlgolia.ts
// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as fs from "fs/promises"
import * as path from "path"
import * as db from "../../db/db.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { getChartsRecords } from "./utils/charts.js"
import {
    getExplorerViewRecords,
    scaleExplorerRecordScores,
} from "./utils/explorerViews.js"
import { getMdimViewRecords } from "./utils/mdimViews.js"
import { MAX_NON_FM_RECORD_SCORE, scaleRecordScores } from "./utils/shared.js"

interface SearchResult {
    query: string
    title: string
    type: string
    hits: number
}

const queryChartsCountsFromAlgolia = async () => {
    const client = getAlgoliaClient()
    if (!client) {
        console.error(`Failed to query charts (Algolia client not initialized)`)
        return
    }

    const indexName = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts
    )
    console.log(`Using Algolia index: "${indexName}"`)
    const index = client.initIndex(indexName)

    // Get all records that would be indexed to Algolia, just like in indexExplorerViewsMdimViewsAndChartsToAlgolia.ts
    const records = await db.knexReadonlyTransaction(async (trx) => {
        const explorerViews = await getExplorerViewRecords(trx, true)
        const mdimViews = await getMdimViewRecords(trx)
        const grapherViews = await getChartsRecords(trx)

        // Process same way as the indexing script
        const scaledGrapherViews = scaleRecordScores(grapherViews, [
            1000,
            MAX_NON_FM_RECORD_SCORE,
        ])
        const scaledExplorerViews = scaleExplorerRecordScores(explorerViews)
        const scaledMdimViews = scaleRecordScores(mdimViews, [
            1000,
            MAX_NON_FM_RECORD_SCORE,
        ])

        const records = [
            ...scaledGrapherViews,
            ...scaledExplorerViews,
            ...scaledMdimViews,
        ]

        return records
    }, db.TransactionCloseMode.Close)

    // Extract chart titles from records to query
    const itemsToQuery = records.map((record) => ({
        id: record.objectID,
        title: record.title,
        type: record.type,
    }))

    console.log(`Found ${itemsToQuery.length} items to query`)

    const results: SearchResult[] = []

    // Query each item in Algolia
    for (let i = 0; i < itemsToQuery.length; i++) {
        const item = itemsToQuery[i]
        try {
            // Query Algolia with the item title
            const searchResponse = await index.search(item.title)

            results.push({
                query: item.title,
                title: item.title,
                type: item.type,
                hits: searchResponse.nbHits,
            })

            if (i % 50 === 0) {
                console.log(`Processed ${i}/${itemsToQuery.length} items`)
            }
        } catch (error) {
            console.error(`Error searching for "${item.title}":`, error)
        }
    }

    // Export CSV with title and hit count
    const csvPath = path.join(process.cwd(), "algoliaHits.csv")
    await fs.writeFile(
        csvPath,
        results
            .map((item) => `"${item.title.replace(/"/g, '""')}",${item.hits}`)
            .join("\n"),
        "utf-8"
    )

    console.log(`CSV with titles and hit counts written to ${csvPath}`)

    // Create and export hit count distribution CSV
    const distributionMap: Record<number, number> = {}

    // Count frequencies
    for (const result of results) {
        if (!distributionMap[result.hits]) {
            distributionMap[result.hits] = 0
        }
        distributionMap[result.hits]++
    }

    // Convert to array of pairs and sort by hit count
    const distribution = Object.entries(distributionMap)
        .map(([hits, count]) => ({ hits: parseInt(hits), count }))
        .sort((a, b) => a.hits - b.hits)

    // Write distribution CSV
    const distributionPath = path.join(
        process.cwd(),
        "algoliaHitsDistribution.csv"
    )
    await fs.writeFile(
        distributionPath,
        "hits,count\n" +
            distribution.map((item) => `${item.hits},${item.count}`).join("\n"),
        "utf-8"
    )

    console.log(`Hit count distribution written to ${distributionPath}`)

    // Generate summary statistics
    const totalHits = results.reduce((sum, item) => sum + item.hits, 0)
    const averageHits = totalHits / results.length
    const maxHits = Math.max(...results.map((item) => item.hits))
    const noHits = results.filter((item) => item.hits === 0).length

    // Group results by type
    const resultsByType: Record<string, SearchResult[]> = {}
    for (const result of results) {
        if (!resultsByType[result.type]) {
            resultsByType[result.type] = []
        }
        resultsByType[result.type].push(result)
    }

    const summaryPath = path.join(process.cwd(), "algoliaSearchSummary.txt")
    await fs.writeFile(
        summaryPath,
        `Algolia Search Results Summary:
Total items queried: ${results.length}
Total hits across all queries: ${totalHits}
Average hits per query: ${averageHits.toFixed(2)}
Maximum hits for a single query: ${maxHits}
Items with no hits: ${noHits} (${((noHits / results.length) * 100).toFixed(2)}%)

Results by type:
${Object.entries(resultsByType)
    .map(([type, items]) => {
        const typeHits = items.reduce((sum, item) => sum + item.hits, 0)
        const typeAvg = typeHits / items.length
        const typeNoHits = items.filter((item) => item.hits === 0).length
        return `- ${type}: ${items.length} items, avg ${typeAvg.toFixed(2)} hits, ${typeNoHits} with no hits (${((typeNoHits / items.length) * 100).toFixed(2)}%)`
    })
    .join("\n")}
`,
        "utf-8"
    )

    console.log(`Summary written to ${summaryPath}`)
}

queryChartsCountsFromAlgolia().catch(async (e) => {
    console.error("Error in queryChartsCountsFromAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
