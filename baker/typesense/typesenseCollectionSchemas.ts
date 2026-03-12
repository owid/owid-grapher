import { CollectionCreateSchema } from "typesense/lib/Typesense/Collections.js"
import { CHARTS_INDEX, PAGES_INDEX } from "../../site/search/searchUtils.js"
import { OPENAI_API_KEY } from "../../settings/serverSettings.js"

export const pagesCollectionSchema: CollectionCreateSchema = {
    name: PAGES_INDEX,
    fields: [
        { name: "id", type: "string" },
        { name: "type", type: "string", facet: true },
        { name: "importance", type: "float" },
        { name: "slug", type: "string", facet: true },
        { name: "title", type: "string" },
        { name: "content", type: "string" },
        { name: "views_7d", type: "int32" },
        { name: "score", type: "int32" },
        { name: "excerpt", type: "string", optional: true },
        { name: "excerptLong", type: "string[]", optional: true },
        {
            name: "authors",
            type: "string[]",
            optional: true,
            facet: true,
        },
        { name: "date", type: "int64", optional: true },
        { name: "modifiedDate", type: "int64", optional: true },
        {
            name: "tags",
            type: "string[]",
            optional: true,
            facet: true,
        },
        { name: "thumbnailUrl", type: "string" },
        {
            name: "availableEntities",
            type: "string[]",
            optional: true,
        },
        {
            name: "embedding",
            type: "float[]",
            embed: {
                from: ["title", "content"],
                model_config: {
                    model_name: "openai/text-embedding-3-small",
                    api_key: OPENAI_API_KEY,
                },
            },
            num_dim: 1536,
            optional: true,
        },
    ],
    default_sorting_field: "score",
}

export const chartsCollectionSchema: CollectionCreateSchema = {
    name: CHARTS_INDEX,
    fields: [
        { name: "id", type: "string" },
        {
            name: "deduplicationId",
            type: "string",
            facet: true,
        },
        { name: "type", type: "string", facet: true },
        { name: "chartId", type: "int32", optional: true },
        { name: "chartConfigId", type: "string", optional: true },
        { name: "slug", type: "string" },
        { name: "title", type: "string" },
        { name: "subtitle", type: "string", optional: true },
        { name: "variantName", type: "string", optional: true },
        {
            name: "tags",
            type: "string[]",
            optional: true,
            facet: true,
        },
        {
            name: "availableEntities",
            type: "string[]",
            optional: true,
        },
        {
            name: "originalAvailableEntities",
            type: "string[]",
            optional: true,
        },
        { name: "keyChartForTags", type: "string[]", optional: true },
        { name: "publishedAt", type: "int64", optional: true },
        { name: "updatedAt", type: "int64", optional: true },
        { name: "numDimensions", type: "int32", optional: true },
        { name: "titleLength", type: "int32" },
        { name: "numRelatedArticles", type: "int32", optional: true },
        { name: "score", type: "int32" },
        {
            name: "viewTitleIndexWithinExplorer",
            type: "int32",
            optional: true,
        },
        { name: "queryParams", type: "string", optional: true },
        { name: "availableTabs", type: "string[]", optional: true },
        { name: "explorerType", type: "string", optional: true },
        {
            name: "embedding",
            type: "float[]",
            embed: {
                from: ["title", "subtitle", "tags"],
                model_config: {
                    model_name: "openai/text-embedding-3-small",
                    api_key: OPENAI_API_KEY,
                },
            },
            num_dim: 1536,
            optional: true,
        },
    ],
    default_sorting_field: "score",
}
