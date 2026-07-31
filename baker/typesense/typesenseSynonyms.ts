import { countries, excludeUndefined } from "@ourworldindata/utils"
import { SynonymItemSchema } from "typesense/lib/Typesense/SynonymSets.js"
import { synonyms } from "../../site/search/synonymUtils.js"
import { getTypeSenseClient } from "./typesenseSearchClient.js"

/**
 * Name of the shared Typesense synonym set. Both the pages and the charts
 * collections reference it via `synonym_sets` in their schemas, so search
 * queries apply it automatically — no per-query parameter needed.
 */
export const SYNONYM_SET_NAME = "owid-synonyms"

// SynonymItemSchema.root makes an item one-way: searching for `root` also
// matches documents containing any of `synonyms`, but not the other way
// around. (Equivalent to Algolia's oneWaySynonym `input`.)

const toItemId = (prefix: string, value: string): string =>
    `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

/**
 * The same synonym configuration configureAlgolia uploads to Algolia,
 * expressed in Typesense's synonym-set format:
 * - the shared synonym groups from site/search/synonymUtils.ts as multi-way
 *   synonyms
 * - every country variant name (short names like "USA", variants like
 *   "United States of America") as a one-way synonym of the canonical
 *   country name
 */
export function buildTypesenseSynonymItems(): SynonymItemSchema[] {
    const items: SynonymItemSchema[] = synonyms.map((group) => ({
        id: toItemId("syn", group.join("-")),
        synonyms: group,
    }))

    for (const country of countries) {
        const alternatives = excludeUndefined([
            country.shortName,
            ...(country.variantNames ?? []),
        ])
        for (const alternative of alternatives) {
            items.push({
                id: toItemId("country", `${alternative}-${country.name}`),
                root: alternative,
                synonyms: [country.name],
            })
        }
    }

    return items
}

/**
 * Upserts the OWID synonym set in Typesense. Idempotent — the upsert (PUT)
 * replaces the whole set.
 */
export async function ensureSynonymSet(): Promise<void> {
    const client = getTypeSenseClient()
    const items = buildTypesenseSynonymItems()
    await client.synonymSets(SYNONYM_SET_NAME).upsert({ items })
    console.log(
        `Ensured synonym set '${SYNONYM_SET_NAME}' exists (${items.length} items)`
    )
}
