import { CollectionCreateSchema } from "typesense/lib/Typesense/Collections.js"
import * as db from "../../db/db.js"
import {
    ChronologicalGdoc,
    PageChronologicalRecord,
} from "@ourworldindata/types"
import { getUniqueNamesFromTagHierarchies } from "@ourworldindata/utils"
import { TYPESENSE_INDEXING } from "../../settings/serverSettings.js"
import { PAGES_CHRONOLOGICAL_INDEX } from "../../site/search/searchUtils.js"
import { getTypeSenseClient } from "./typesenseSearchClient.js"
import { buildChronologicalRecord } from "../algolia/utils/pagesChronological.js"
import { convertDateToUnixTimestamp } from "./indexPagesToTypeSense.js"

/**
 * Lightweight chronological collection — one record per page, no chunked
 * content. Sorted by date (newest first) for /latest and the dynamic Atom
 * feed. Neither surface does free-text search, so only the fields used for
 * filtering, faceting and sorting are declared; the rest of each
 * `PageChronologicalRecord` (title, date strings, enriched-block payloads,
 * linked attachments, …) rides along as undeclared fields, which Typesense
 * stores and returns but doesn't index.
 */
export const pagesChronologicalCollectionSchema: CollectionCreateSchema = {
    name: PAGES_CHRONOLOGICAL_INDEX,
    fields: [
        { name: "type", type: "string", facet: true },
        { name: "latestType", type: "string", facet: true, optional: true },
        { name: "tags", type: "string[]", facet: true, optional: true },
        // `date` is an ISO string on the record; Typesense needs a numeric
        // field to sort on.
        { name: "dateTimestamp", type: "int64" },
    ],
    default_sorting_field: "dateTimestamp",
}

export function toTypesenseChronologicalRecord(
    record: PageChronologicalRecord
): Record<string, unknown> {
    return {
        ...record,
        id: record.objectID,
        objectID: undefined,
        dateTimestamp: convertDateToUnixTimestamp(record.date) ?? 0,
    }
}

/**
 * Typesense counterpart of indexIndividualGdocInChronological: upserts a
 * single gdoc into the chronological collection when it's published from the
 * admin, so announcements and data insights show up on /latest immediately
 * rather than after the next full reindex.
 */
export async function indexIndividualGdocInChronologicalTypesense(
    gdoc: ChronologicalGdoc,
    knex: db.KnexReadonlyTransaction
): Promise<void> {
    if (!TYPESENSE_INDEXING) return

    // Don't index scheduled posts (publishedAt in the future); they're picked
    // up by indexScheduledPagesChronologicalToTypeSense once they go live.
    const isScheduled = gdoc.publishedAt
        ? gdoc.publishedAt.getTime() > Date.now()
        : false
    if (isScheduled) return

    const client = getTypeSenseClient()

    const cloudflareImagesByFilename =
        await db.getCloudflareImagesByFilename(knex)

    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(knex)
    const originalTagNames = gdoc.tags?.map((t) => t.name) ?? []
    const topicTags = getUniqueNamesFromTagHierarchies(
        originalTagNames,
        topicHierarchiesByChildName
    )

    const record = await buildChronologicalRecord(
        gdoc,
        topicTags,
        cloudflareImagesByFilename
    )
    if (!record) return

    try {
        await client
            .collections(PAGES_CHRONOLOGICAL_INDEX)
            .documents()
            .upsert(toTypesenseChronologicalRecord(record))
    } catch (e) {
        console.error(
            "Error indexing gdoc to Typesense pages-chronological:",
            e
        )
    }
}

export async function removeIndividualGdocFromChronologicalTypesense(
    gdocId: string
): Promise<void> {
    if (!TYPESENSE_INDEXING) return

    const client = getTypeSenseClient()
    try {
        await client
            .collections(PAGES_CHRONOLOGICAL_INDEX)
            .documents(gdocId)
            .delete()
    } catch (e) {
        // Deleting a document that isn't in the collection is fine
        console.error(
            "Error removing gdoc from Typesense pages-chronological:",
            e
        )
    }
}
