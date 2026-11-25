import { createHash } from "node:crypto"
import { Turbopuffer, type AttributeSchema } from "@turbopuffer/turbopuffer"
import { ChartRecord } from "@ourworldindata/types"
import { TURBOPUFFER_REGION } from "@ourworldindata/utils"
import { TURBOPUFFER_API_KEY } from "../../settings/serverSettings.js"
import { MIN_SCALED_RECORD_SCORE } from "../algolia/utils/shared.js"

const EMBEDDING_MODEL = "baai/bge-m3"
const SUBTITLE_CHARS_IN_SEARCH_TEXT = 300
const MAX_ID_BYTES = 64

export function getTurbopufferClient(): Turbopuffer {
    if (!TURBOPUFFER_API_KEY) throw new Error("Missing TURBOPUFFER_API_KEY")
    return new Turbopuffer({
        apiKey: TURBOPUFFER_API_KEY,
        region: TURBOPUFFER_REGION,
    })
}

// A type alias, not an interface, so it satisfies the SDK's indexed `Row` type
export type ChartRow = {
    id: string
    /** The record's `id` (e.g. `grapher/life-expectancy`), the key for grouping like Algolia's `distinct` */
    chart_key: string
    type: string
    slug: string
    queryParams: string
    title: string
    subtitle: string
    variantName: string
    containerTitle: string
    tags: string[]
    availableEntities: string[]
    /** Title, variant, container, the start of the subtitle and tags: embedded, fuzzy-matched, and the text a reranker would score */
    search_text: string
    /**
     * The record's score above the floor it is scaled to, so proportional to
     * 7-day views + 500 × related articles, with featured-metric boosts kept
     */
    popularity: number
    /** Start time (ms) of the indexing run that wrote the row; older rows are deleted at the end of a run */
    indexed_at: number
}

// Plurals and other word forms match, like Algolia's `ignorePlurals`
const STEMMED = { stemming: true }

export const CHARTS_SCHEMA: Record<string, AttributeSchema> = {
    chart_key: "string",
    type: "string",
    slug: { type: "string", filterable: false },
    queryParams: { type: "string", filterable: false },
    title: { type: "string", full_text_search: STEMMED },
    subtitle: { type: "string", full_text_search: STEMMED },
    variantName: { type: "string", full_text_search: STEMMED },
    containerTitle: { type: "string", full_text_search: STEMMED },
    // Full-text attributes aren't filterable by default, but tags are also a topic filter
    tags: { type: "[]string", full_text_search: STEMMED, filterable: true },
    availableEntities: "[]string",
    search_text: {
        type: "string",
        embed: EMBEDDING_MODEL,
        fuzzy: true,
        filterable: false,
    },
    popularity: "uint",
    indexed_at: "uint",
}

function rowId(objectID: string): string {
    if (Buffer.byteLength(objectID, "utf8") <= MAX_ID_BYTES) return objectID
    return `sha256-${createHash("sha256").update(objectID).digest("hex").slice(0, 48)}`
}

/**
 * Everything that says what a chart is about, for the embedding: a bare title
 * like "Population" embeds close to every query, so the vector half returned
 * such charts for queries nothing matches
 */
export function makeSearchText(record: ChartRecord): string {
    const { title, variantName, containerTitle, subtitle, tags } = record
    const parts = [
        variantName && variantName !== title
            ? `${title} (${variantName})`
            : title,
        containerTitle,
        (subtitle ?? "").slice(0, SUBTITLE_CHARS_IN_SEARCH_TEXT).trim(),
        tags.length > 0 ? `Topics: ${tags.join(", ")}` : undefined,
    ]
    return parts
        .filter((part): part is string => Boolean(part))
        .map((part) => part.replace(/\.$/, ""))
        .join(". ")
}

/**
 * One row per non-FM record. FM records are Algolia's editorial copies for
 * empty-query topic browsing; typed searches already exclude them.
 */
export function toChartRow(record: ChartRecord, indexedAt: number): ChartRow {
    return {
        id: rowId(record.objectID),
        chart_key: record.id,
        type: record.type,
        slug: record.slug,
        queryParams: record.queryParams ?? "",
        title: record.title,
        subtitle: record.subtitle ?? "",
        variantName: record.variantName ?? "",
        containerTitle: record.containerTitle ?? "",
        tags: record.tags,
        availableEntities: record.availableEntities,
        search_text: makeSearchText(record),
        // Explorer views downranked as near-duplicates have negative scores; none do today
        popularity: Math.max(0, record.score - MIN_SCALED_RECORD_SCORE),
        indexed_at: indexedAt,
    }
}
