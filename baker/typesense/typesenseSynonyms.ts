import { countries, excludeUndefined } from "@ourworldindata/utils"
import { synonyms } from "../../site/search/synonymUtils.js"
import {
    TYPESENSE_API_KEY,
    TYPESENSE_HOST,
    TYPESENSE_PORT,
    TYPESENSE_PROTOCOL,
} from "../../settings/serverSettings.js"

/**
 * Name of the shared Typesense synonym set. Both the pages and the charts
 * collections reference it via `synonym_sets` in their schemas, so search
 * queries apply it automatically — no per-query parameter needed.
 */
export const SYNONYM_SET_NAME = "owid-synonyms"

interface TypesenseSynonymItem {
    id: string
    synonyms: string[]
    /**
     * When set, the synonym is one-way: searching for `root` also matches
     * documents containing any of `synonyms`, but not the other way around.
     * (Equivalent to Algolia's oneWaySynonym `input`.)
     */
    root?: string
}

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
export function buildTypesenseSynonymItems(): TypesenseSynonymItem[] {
    const items: TypesenseSynonymItem[] = synonyms.map((group) => ({
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
 * Upserts the OWID synonym set in Typesense. Idempotent — the PUT replaces
 * the whole set. Uses a raw fetch because the `typesense` npm client (2.x)
 * predates the v30 `/synonym_sets` API (the per-collection synonyms API it
 * knows was removed from the server in v30).
 */
export async function ensureSynonymSet(): Promise<void> {
    const url = `${TYPESENSE_PROTOCOL}://${TYPESENSE_HOST}:${TYPESENSE_PORT}/synonym_sets/${SYNONYM_SET_NAME}`
    const items = buildTypesenseSynonymItems()
    const response = await fetch(url, {
        method: "PUT",
        headers: {
            "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ items }),
    })
    if (!response.ok) {
        const body = await response.text()
        throw new Error(
            `Failed to upsert synonym set (${response.status}): ${body}`
        )
    }
    console.log(
        `Ensured synonym set '${SYNONYM_SET_NAME}' exists (${items.length} items)`
    )
}
