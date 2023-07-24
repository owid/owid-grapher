import { Country } from "@ourworldindata/utils"
import type { SearchResponse } from "@algolia/client-search"

export type PageType =
    | "about"
    | "topic"
    | "country"
    | "faq"
    | "article"
    | "other"

export interface PageRecord {
    objectID: string
    type: PageType
    importance: number
    slug: string
    title: string
    content: string
    views_7d: number
    score: number
    excerpt?: string
    authors?: string[]
    date?: string
    modifiedDate?: string
    tags?: string[]
    documentType?: "wordpress" | "gdoc" | "country-page"
}

export type AlgoliaMatchLevel = "none" | "full" | "partial"

export type AlgoliaHit = {
    _snippetResult?: {
        content?: {
            value: string
            matchLevel: AlgoliaMatchLevel
        }
        excerpt?: {
            value: string
            matchLevel: AlgoliaMatchLevel
        }
    }
    _highlightResult: {
        title: {
            value: string
            matchLevel: AlgoliaMatchLevel
        }
    }
}

export type PageHit = PageRecord & AlgoliaHit

//     type: "article" | "topic"
//     importance: number
//     slug: string
//     title: string
//     excerpt: string
//     authors: string[]
//     date: string
//     modifiedDate: string
//     content: string
//     tags: string[]
//     objectID: string
// }

export type ExplorerHit = AlgoliaHit & {
    objectID: string
    slug: string
    subtitle: string
    text: string
    title: string
    views_7d: number
}

export interface ChartRecord {
    objectID: string
    chartId: number
    slug: string
    title: string
    subtitle: string
    variantName: string
    keyChartForTags: string[]
    tags: string[]
    availableEntities: string[]
    publishedAt: string
    updatedAt: string
    numDimensions: number
    titleLength: number
    numRelatedArticles: number
    views_7d: number
    score: number
}

export interface ChartHit extends ChartRecord {
    _snippetResult?: {
        subtitle?: {
            value: string
        }
    }
    _highlightResult?: {
        title?: {
            value: string
            matchLevel: AlgoliaMatchLevel
        }
        availableEntities?: {
            value: string
            matchLevel: AlgoliaMatchLevel
            fullyHighlighted: boolean
            matchedWords: string[]
        }[]
    }
}

export interface SiteSearchResults {
    pages: SearchResponse<PageHit>
    charts: SearchResponse<ChartHit>
    countries: Country[]
}
