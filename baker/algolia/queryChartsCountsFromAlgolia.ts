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

interface SearchResult {
    query: string
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

    // Get all suggestions from the search_suggestions table
    const suggestions = await db.knexReadonlyTransaction(async (trx) => {
        const suggestions = await db.knexRaw<{
            suggestion: string
        }>(trx, `SELECT DISTINCT suggestion from search_suggestions`)
        return suggestions
    }, db.TransactionCloseMode.Close)

    // Extract suggestions to query
    const itemsToQuery = suggestions.map((suggestion, index) => ({
        id: `suggestion_${index}`,
        suggestion: suggestion.suggestion,
    }))

    console.log(`Found ${itemsToQuery.length} items to query`)

    const results: SearchResult[] = []

    // Query each item in Algolia
    for (let i = 0; i < itemsToQuery.length; i++) {
        const item = itemsToQuery[i]
        try {
            // Query Algolia with the suggestion text
            const searchResponse = await index.search(item.suggestion)

            results.push({
                query: item.suggestion,
                hits: searchResponse.nbHits,
            })

            if (i % 50 === 0) {
                console.log(`Processed ${i}/${itemsToQuery.length} items`)
            }
        } catch (error) {
            console.error(`Error searching for "${item.suggestion}":`, error)
        }
    }

    // Export CSV with suggestion and hit count
    const csvPath = path.join(process.cwd(), "algoliaHits.csv")
    await fs.writeFile(
        csvPath,
        results
            .map((item) => `"${item.query.replace(/"/g, '""')}";${item.hits}`)
            .join("\n"),
        "utf-8"
    )

    console.log(`CSV with suggestions and hit counts written to ${csvPath}`)

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

    const summaryPath = path.join(process.cwd(), "algoliaSearchSummary.txt")
    await fs.writeFile(
        summaryPath,
        `Algolia Search Results Summary:
Total items queried: ${results.length}
Total hits across all queries: ${totalHits}
Average hits per query: ${averageHits.toFixed(2)}
Maximum hits for a single query: ${maxHits}
Items with no hits: ${noHits} (${((noHits / results.length) * 100).toFixed(2)}%)
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
