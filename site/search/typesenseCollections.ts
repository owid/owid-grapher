import { CollectionCreateSchema } from "typesense/lib/Typesense/Collections.js"
import { CHARTS_INDEX, PAGES_INDEX } from "./searchUtils.js"

// Document types for type-safe search results
export interface PageDocument {
    id: string
    type: string
    importance: number
    slug: string
    title: string
    content: string
    views_7d: number
    score: number
    excerpt?: string
    excerptLong?: string[]
    authors?: string[]
    date?: number
    modifiedDate?: number
    tags?: string[]
    thumbnailUrl: string
}

export interface ChartDocument {
    id: string
    type: string
    chartId?: number
    chartConfigId?: string
    slug: string
    title: string
    subtitle?: string
    variantName?: string
    tags?: string[]
    availableEntities?: string[]
    originalAvailableEntities?: string[]
    keyChartForTags?: string[]
    publishedAt?: number
    updatedAt?: number
    numDimensions?: number
    titleLength: number
    numRelatedArticles?: number
    score: number
    viewTitleIndexWithinExplorer?: number
    queryParams?: string
    availableTabs?: string[]
    explorerType?: string
}

// Collection schema for pages
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
    ],
    default_sorting_field: "score",
}

// Collection schema for charts/explorer views
export const chartsCollectionSchema: CollectionCreateSchema = {
    name: CHARTS_INDEX,
    fields: [
        { name: "id", type: "string" },
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
    ],
    default_sorting_field: "score",
}
