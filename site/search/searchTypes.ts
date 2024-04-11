import { BaseHit, Hit } from "instantsearch.js/es/types/results.js"

export type PageType =
    | "about"
    | "topic"
    | "country"
    | "faq"
    | "article"
    | "other"

export const pageTypeDisplayNames: Record<PageType, string> = {
    about: "About",
    topic: "Topic",
    country: "Country",
    faq: "FAQ",
    article: "Article",
    other: "Topic", // this is a band-aid to avoid showing "Other" for items that we now largely consider to be "Topics". Caveat: some non-topic pages are still indexed as "other" (e.g. /jobs). See https://owid.slack.com/archives/C04N12KT6GY/p1693580177430049?thread_ts=1693336759.239919&cid=C04N12KT6GY
}

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
    // Either a URL (for WP posts) or a filepath (for GDocs)
    // WP example: https://ourworldindata.org/wp-content/uploads/2021/03/Biodiversity-thumbnail.png
    // GDoc example: /images/published/artificial-intelligence-featured-image_100.png
    thumbnail: string
    documentType?: "wordpress" | "gdoc" | "country-page"
}

export type IPageHit = PageRecord & Hit<BaseHit>

export type IExplorerViewHit = Hit<BaseHit> & {
    objectID: string

    // Explorer-wide fields
    explorerSlug: string
    explorerTitle: string
    explorerSubtitle: string
    numViewsWithinExplorer: number

    // View-specific fields
    viewTitle: string
    viewSubtitle: string
    viewQueryParams: string
    viewTitleIndexWithinExplorer: number
}

export interface ChartRecord {
    objectID: string
    chartId: number
    slug: string
    title: string
    subtitle: string | undefined
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

export type IChartHit = Hit<BaseHit> & ChartRecord

export enum SearchIndexName {
    ExplorerViews = "explorer-views",
    Charts = "charts",
    Pages = "pages",
}

export type SearchCategoryFilter = SearchIndexName | "all"

export const searchCategoryFilters: [string, SearchCategoryFilter][] = [
    ["All", "all"],
    ["Research & Writing", SearchIndexName.Pages],
    ["Charts", SearchIndexName.Charts],
    ["Data Explorers", SearchIndexName.ExplorerViews],
]

export const indexNameToSubdirectoryMap: Record<SearchIndexName, string> = {
    [SearchIndexName.Pages]: "",
    [SearchIndexName.Charts]: "/grapher",
    [SearchIndexName.ExplorerViews]: "/explorers",
}
