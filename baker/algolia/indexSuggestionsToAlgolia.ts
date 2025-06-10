// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import * as db from "../../db/db.js"
import { ALGOLIA_INDEXING } from "../../settings/serverSettings.js"
import { getAlgoliaClient } from "./configureAlgolia.js"
import {
    SearchIndexName,
    SuggestionRecord,
} from "../../site/search/searchTypes.js"
import { getIndexName } from "../../site/search/searchClient.js"

const getSuggestionsRecords = async (
    trx: db.KnexReadonlyTransaction
): Promise<SuggestionRecord[]> => {
    const suggestions = await db.knexRaw<{
        suggestion: string
        score: number
    }>(
        trx,
        `SELECT suggestion, MAX(score) AS score
        FROM search_suggestions
        GROUP BY suggestion;`
    )

    // Convert to suggestion records for Algolia
    const records: SuggestionRecord[] = suggestions.map((row) => ({
        objectID: row.suggestion,
        suggestion: row.suggestion,
        score: row.score,
    }))

    console.log(`Retrieved ${records.length} suggestions from database`)
    return records
}

const indexSuggestionsToAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(
            `Failed indexing suggestions (Algolia client not initialized)`
        )
        return
    }

    const index = client.initIndex(getIndexName(SearchIndexName.Suggestions))

    const records = await db.knexReadonlyTransaction(
        getSuggestionsRecords,
        db.TransactionCloseMode.Close
    )

    console.log(`Indexing ${records.length} suggestion records`)
    await index.replaceAllObjects(records)
    console.log(`Indexing complete`)
}

indexSuggestionsToAlgolia().catch(async (e) => {
    console.error("Error in indexSuggestionsToAlgolia:", e)
    Sentry.captureException(e)
    await Sentry.close()
    process.exit(1)
})
