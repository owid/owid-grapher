import { PageChronologicalRecord } from "@ourworldindata/types"

/** Grid positioning applied to the root of every hit card. */
export const LATEST_HIT_GRID_CLASSES =
    "span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"

/**
 * Shape the hit record into the AttachmentsContext value expected by the
 * gdoc components that render inside each card (Image, ArticleBlocks, etc.).
 */
export function makeAttachments(hit: PageChronologicalRecord) {
    return {
        imageMetadata: hit.imageMetadata ?? {},
        linkedAuthors: hit.linkedAuthors ?? [],
        linkedCharts: hit.linkedCharts ?? {},
        linkedDocuments: hit.linkedDocuments ?? {},
        // Intentionally empty: card-level rendering doesn't reach into these,
        // and indexing them per record would inflate the Algolia payload
        // unnecessarily. If a future card type needs them, add them to
        // PageChronologicalRecord and to the indexer in pagesChronological.ts.
        linkedIndicators: {},
        relatedCharts: [],
        tags: [],
    }
}
