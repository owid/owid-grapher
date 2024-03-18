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
    documentType?: "wordpress" | "gdoc" | "country-page"
}

export type IPageHit = PageRecord & Hit<BaseHit>

export type IExplorerViewHit = Hit<BaseHit> & {
    objectID: string
    explorerSlug: string
    viewTitle: string
    explorerTitle: string
    viewQueryParams: string
}

export type IExplorerHit = Hit<BaseHit> & {
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
    Explorers = "explorers",
    ExplorerViews = "explorer-views",
    Charts = "charts",
    Pages = "pages",
}

export type SearchCategoryFilter = SearchIndexName | "all"

export const searchCategoryFilters: [string, SearchCategoryFilter][] = [
    ["All", "all"],
    ["Research & Writing", SearchIndexName.Pages],
    ["Data Explorers", SearchIndexName.Explorers],
    ["Charts", SearchIndexName.Charts],
]

export const indexNameToSubdirectoryMap: Record<SearchIndexName, string> = {
    [SearchIndexName.Pages]: "",
    [SearchIndexName.Charts]: "/grapher",
    [SearchIndexName.Explorers]: "/explorers",
    [SearchIndexName.ExplorerViews]: "/explorers",
}
