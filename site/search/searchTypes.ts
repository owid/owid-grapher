import { OwidGdocType } from "@ourworldindata/types"
import { BaseHit, Hit } from "instantsearch.js/es/types/results.js"

export enum WordpressPageType {
    Other = "other",
    Country = "country",
}

export function checkIsWordpressPageType(
    type: string
): type is WordpressPageType {
    return (
        type === WordpressPageType.Country || type === WordpressPageType.Other
    )
}

export type PageType = OwidGdocType | WordpressPageType

export const pageTypeDisplayNames: Record<PageType, string> = {
    [OwidGdocType.AboutPage]: "About",
    [OwidGdocType.Article]: "Article",
    [OwidGdocType.DataInsight]: "Data Insight",
    [OwidGdocType.LinearTopicPage]: "Topic",
    [OwidGdocType.TopicPage]: "Topic",
    [WordpressPageType.Country]: "Country",
    [WordpressPageType.Other]: "",
    [OwidGdocType.Author]: "", // Should never be indexed
    [OwidGdocType.Fragment]: "", // Should never be indexed
    [OwidGdocType.Homepage]: "", // Should never be indexed
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
    // WP example: https://ourworldindata.org/wp-content/uploads/2021/03/Biodiversity-thumbnail.png
    // GDoc example: https://imagedelivery.net/our-id/image-uuid/w=512
    // Fallback example: https://ourworldindta.org/default-thumbnail.png
    thumbnailUrl: string
    documentType?: "wordpress" | "gdoc" | "country-page"
}

export type IPageHit = PageRecord & Hit<BaseHit>

export enum ChartRecordType {
    Chart = "chart",
    ExplorerView = "explorerView",
    MultiDimView = "multiDimView",
}

export interface ChartRecord {
    type: ChartRecordType
    objectID: string
    chartId: number
    slug: string
    queryParams?: string
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
    // we set attributeForDistinct on this, so we can use it to deduplicate
    // when we have multiple records for the same chart (e.g. with featured metrics)
    id: string
}

export type IChartHit = Hit<BaseHit> & ChartRecord

export enum SearchIndexName {
    Charts = "charts",
    Pages = "pages",
    ExplorerViewsMdimViewsAndCharts = "explorer-views-and-charts",
}

export type SearchCategoryFilter = SearchIndexName | "all"

export const searchCategoryFilters: [string, SearchCategoryFilter][] = [
    ["All", "all"],
    ["Research & Writing", SearchIndexName.Pages],
    ["Charts", SearchIndexName.ExplorerViewsMdimViewsAndCharts],
]
