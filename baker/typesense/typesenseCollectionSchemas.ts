import { CollectionCreateSchema } from "typesense/lib/Typesense/Collections.js"
import { CHARTS_INDEX, PAGES_INDEX } from "../../site/search/searchUtils.js"

// Typesense counterparts of the Algolia index settings in
// baker/algolia/configureAlgolia.ts. Read the two side by side when changing
// either: the goal is that a query returns the same documents in (close to) the
// same order from both backends.
//
// Keyword search only — no `embedding` field and no `embed` model config, so
// indexing needs no OpenAI round-trip and a full reindex takes minutes rather
// than an hour.

export const pagesCollectionSchema: CollectionCreateSchema = {
    name: PAGES_INDEX,
    fields: [
        { name: "id", type: "string" },
        { name: "type", type: "string", facet: true },
        { name: "importance", type: "float" },
        { name: "slug", type: "string", facet: true },
        // Algolia dedups this index on `path`, not `slug`: a data insight and
        // an article can share a bare slug while resolving to different pages
        // (#6591). `group_by: "path"` is the Typesense equivalent.
        { name: "path", type: "string", facet: true },
        { name: "title", type: "string" },
        { name: "content", type: "string" },
        { name: "views_7d", type: "int32" },
        { name: "score", type: "int32" },
        { name: "excerpt", type: "string", optional: true },
        { name: "excerptLong", type: "string[]", optional: true },
        { name: "authors", type: "string[]", optional: true, facet: true },
        { name: "date", type: "int64", optional: true },
        { name: "modifiedDate", type: "int64", optional: true },
        { name: "tags", type: "string[]", optional: true, facet: true },
        { name: "thumbnailUrl", type: "string" },
        { name: "availableEntities", type: "string[]", optional: true },
    ],
    default_sorting_field: "score",
}

export const chartsCollectionSchema: CollectionCreateSchema = {
    name: CHARTS_INDEX,
    fields: [
        { name: "id", type: "string" },
        // Algolia's `attributeForDistinct: "id"`. The indexer moves the
        // record's `objectID` into `id` (Typesense's reserved primary key), so
        // the original Algolia `id` ("grapher/slug", "explorer/slug?params") is
        // carried here and used as `group_by`.
        { name: "deduplicationId", type: "string", facet: true },
        { name: "type", type: "string", facet: true },
        { name: "chartId", type: "int32", optional: true },
        { name: "chartConfigId", type: "string", optional: true },
        { name: "slug", type: "string" },
        { name: "title", type: "string" },
        { name: "containerTitle", type: "string", optional: true },
        { name: "subtitle", type: "string", optional: true },
        { name: "variantName", type: "string", optional: true },
        { name: "tags", type: "string[]", optional: true, facet: true },
        { name: "availableEntities", type: "string[]", optional: true },
        {
            name: "originalAvailableEntities",
            type: "string[]",
            optional: true,
        },
        { name: "keyChartForTags", type: "string[]", optional: true },
        // Dataset facets — site-only filters (the public API doesn't expose
        // them). Mirrors `attributesForFaceting` on the Algolia charts index.
        { name: "datasetNamespaces", type: "string[]", optional: true },
        { name: "datasetVersions", type: "string[]", optional: true },
        { name: "datasetProducts", type: "string[]", optional: true },
        { name: "datasetProducers", type: "string[]", optional: true },
        { name: "publishedAt", type: "int64", optional: true },
        { name: "updatedAt", type: "int64", optional: true },
        { name: "numDimensions", type: "int32", optional: true },
        { name: "titleLength", type: "int32" },
        { name: "numRelatedArticles", type: "int32", optional: true },
        { name: "score", type: "int32" },
        { name: "viewTitleIndexWithinExplorer", type: "int32", optional: true },
        // viewTitleIndexWithinExplorer and titleLength combined into one
        // sortable field, because Typesense allows only 3 sort fields and the
        // Algolia ranking we mirror needs 4. See `computeRankTiebreaker`.
        { name: "rankTiebreaker", type: "int32" },
        { name: "queryParams", type: "string", optional: true },
        { name: "availableTabs", type: "string[]", optional: true },
        { name: "isFM", type: "bool", facet: true, optional: true },
        {
            name: "isIncomeGroupSpecificFM",
            type: "bool",
            facet: true,
            optional: true,
        },
        { name: "explorerType", type: "string", optional: true },
    ],
    default_sorting_field: "score",
}
