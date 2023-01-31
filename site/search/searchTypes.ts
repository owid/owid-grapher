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

export interface PageHit extends PageRecord {
    _snippetResult: {
        content: {
            value: string
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
}

export interface ChartHit extends ChartRecord {
    _snippetResult?: {
        subtitle: {
            value: string
        }
    }
    _highlightResult?: {
        availableEntities: {
            value: string
            matchLevel: "none" | "full"
            matchedWords: string[]
        }[]
    }
}

export interface SiteSearchResults {
    pages: PageHit[]
    charts: ChartHit[]
    countries: Country[]
}
