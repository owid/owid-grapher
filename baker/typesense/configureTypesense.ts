// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import { countries, excludeUndefined } from "@ourworldindata/utils"
import { TYPESENSE_SYNONYM_SET } from "@ourworldindata/utils"
import {
    TYPESENSE_API_KEY,
    TYPESENSE_HOST,
    TYPESENSE_INDEXING,
    TYPESENSE_PORT,
    TYPESENSE_PROTOCOL,
} from "../../settings/serverSettings.js"
import { synonyms } from "../../site/search/synonymUtils.js"
import { getTypeSenseClient } from "./typesenseSearchClient.js"
import { ensureStopwordsSet } from "./typesenseCacheTable.js"

// Typesense counterpart of baker/algolia/configureAlgolia.ts, limited to what
// Typesense stores server-side: stopwords and synonyms. The rest of the Algolia
// index settings (searchable attributes, ranking) are query-time parameters in
// Typesense and live in @ourworldindata/utils/search/typesenseSearchParams.ts.
//
// Both are *global* resources referenced by name from each query, not
// collection settings — so unlike the collection schemas, they survive a
// reindex and this can run before or after the indexers.

interface TypesenseSynonymItem {
    id: string
    synonyms: string[]
    /** Set for one-way synonyms: `root` maps to `synonyms`, but not back. */
    root?: string
}

export function buildSynonymItems(): TypesenseSynonymItem[] {
    const items: TypesenseSynonymItem[] = synonyms.map((group, i) => ({
        // Ids only need to be unique and stable within the set.
        id: `multi-${i}`,
        synonyms: group,
    }))

    // Send all our country variant names as one-way synonyms, so that e.g.
    // "USA" finds "United States" but not the other way round.
    for (const country of countries) {
        const alternatives = excludeUndefined([
            country.shortName,
            ...(country.variantNames ?? []),
        ])
        for (const alternative of alternatives) {
            items.push({
                id: `one-way-${alternative}-${country.name}`.replace(
                    /[^a-zA-Z0-9-]/g,
                    "-"
                ),
                root: alternative,
                synonyms: [country.name],
            })
        }
    }

    return items
}

/**
 * Upserts the synonym set.
 *
 * Done over REST rather than through the `typesense` npm client: as of v2.1.0
 * the client still exposes only the per-collection synonyms API, which
 * Typesense 30 removed in favour of these named sets.
 */
async function upsertSynonymSet(items: TypesenseSynonymItem[]): Promise<void> {
    const url = `${TYPESENSE_PROTOCOL}://${TYPESENSE_HOST}:${TYPESENSE_PORT}/synonym_sets/${TYPESENSE_SYNONYM_SET}`

    const response = await fetch(url, {
        method: "PUT",
        headers: {
            "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY,
            "Content-Type": "application/json",
        },
        // A full replace, so a synonym removed from synonymUtils.ts actually
        // disappears rather than lingering.
        body: JSON.stringify({ items }),
    })

    if (!response.ok) {
        throw new Error(
            `Failed to upsert synonym set (${response.status}): ${await response.text()}`
        )
    }

    console.log(
        `Upserted ${items.length} synonyms into set: ${TYPESENSE_SYNONYM_SET}`
    )
}

export const configureTypesense = async (): Promise<void> => {
    if (!TYPESENSE_INDEXING) return

    const client = getTypeSenseClient()
    if (!client)
        // throwing here to halt the deploy process
        throw new Error(
            "Typesense configuration failed (client not initialized)"
        )

    await ensureStopwordsSet(client)
    await upsertSynonymSet(buildSynonymItems())
}

if (require.main === module) {
    void configureTypesense().catch(async (e) => {
        console.error("Error in configureTypesense:", e)
        Sentry.captureException(e)
        await Sentry.close()
        process.exit(1)
    })
}
