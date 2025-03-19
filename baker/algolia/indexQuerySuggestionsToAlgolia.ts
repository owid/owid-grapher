// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import { getIndexName } from "../../site/search/searchClient.js"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"

interface SearchSuggestion {
    suggestion: string
    objectID: number
}

/**
 * Get all unique search suggestions from the database
 */
async function getSearchSuggestions(
    knex: db.KnexReadonlyTransaction
): Promise<SearchSuggestion[]> {
    const rows = await db.knexRaw<{ suggestion: string }>(
        knex,
        `-- sql
        SELECT suggestion
        FROM search_suggestions_unique
        WHERE suggestion IS NOT NULL
        ORDER BY suggestion
        `
    )

    return rows.map((row, index) => ({
        suggestion: row.suggestion,
        objectID: index,
    }))
}

const indexQuerySuggestionsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const indexName = getIndexName(SearchIndexName.SearchSuggestions)
    console.log(
        `Indexing query suggestions to the "${indexName}" index on Algolia`
    )
    const client = getAlgoliaClient()
    if (!client) {
        throw new Error(
            `Failed indexing query suggestions (Algolia client not initialized)`
        )
    }

    const searchSuggestions = await db.knexReadonlyTransaction(
        async (trx) => await getSearchSuggestions(trx),
        db.TransactionCloseMode.Close
    )

    console.log(`Found ${searchSuggestions.length} search suggestions`)

    const index = client.initIndex(indexName)

    await index.replaceAllObjects(searchSuggestions)

    console.log(`Indexed ${searchSuggestions.length} search suggestions`)
    console.log(`Indexing complete`)
}

indexQuerySuggestionsToAlgolia().catch(async (e) => {
    console.error("Error in indexQuerySuggestionsToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
