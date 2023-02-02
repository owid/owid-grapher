import { Country } from "@ourworldindata/utils"

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
    slug: string
    title: string
    content: string
    postId?: number
    excerpt?: string
    authors?: string[]
    date?: string
    modifiedDate?: string
    tags?: string[]
}

export type AlgoliaMatchLevel = "none" | "full" | "partial"

export interface PageHit extends PageRecord {
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
        }[]
    }
}

export interface SiteSearchResults {
    pages: PageHit[]
    charts: ChartHit[]
    countries: Country[]
}
