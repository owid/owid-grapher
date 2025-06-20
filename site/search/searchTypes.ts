import { OwidGdocType } from "@ourworldindata/types"
import { SearchResponse, SearchForFacetValuesResponse } from "instantsearch.js"
import {
    BaseHit,
    Hit,
    HitHighlightResult,
} from "instantsearch.js/es/types/results.js"

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
    /**
     * Only present for income group-specific FMs: availableEntities before it gets filtered down.
     * Without this, searching for charts with data for "Uganda" OR "United States" would return
     * the FM version of the chart that only has Uganda in its available entities, and thus we
     * wouldn't plot the data for the US, even though the chart has data for the US.
     */
    originalAvailableEntities?: string[]
    /**
     * Also only set for FMs: used so that we can filter out income group-specific FMs on a plain data catalog view.
     */
    isIncomeGroupSpecificFM: boolean
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

/**
 * This is a type that algolia doesn't export but is necessary to work with the algolia client
 * Effectively the same as Awaited<ReturnType<SearchClient["search"]>>, but generic
 */
export type MultipleQueriesResponse<TObject> = {
    results: Array<SearchResponse<TObject> | SearchForFacetValuesResponse>
}

/**
 * This is the type for the hits that we get back from algolia when we search
 * response.results[0].hits is an array of these
 */
export type SearchChartHit = {
    title: string
    slug: string
    availableEntities: string[]
    originalAvailableEntities?: string[]
    objectID: string
    variantName: string | null
    type: ChartRecordType
    queryParams: string
    __position: number
    _highlightResult?: HitHighlightResult
    _snippetResult?: HitHighlightResult
}

// SearchResponse adds the extra fields from Algolia: page, nbHits, etc
export type SearchChartsResponse = SearchResponse<SearchChartHit>

// We add a title field to the SearchResponse for the ribbons
export type SearchDataTopicsResponse = SearchResponse<SearchChartHit> & {
    title: string
}

export type ScoredSearchResult = {
    name: string
    score: number
}

export type DataInsightHit = {
    title: string
    thumbnailUrl: string
    date: string
    slug: string
    objectID: string
    __position: number
}

export type SearchDataInsightResponse = SearchResponse<DataInsightHit>

export type ArticleHit = {
    title: string
    thumbnailUrl: string
    date: string
    slug: string
    type: OwidGdocType.Article | OwidGdocType.AboutPage
    content: string
    authors: string[]
    objectID: string
    __position: number
}

export type SearchArticleResponse = SearchResponse<ArticleHit>

export type TopicPageHit = {
    title: string
    type: OwidGdocType.TopicPage | OwidGdocType.LinearTopicPage
    slug: string
    excerpt: string
    objectID: string
    __position: number
}

export type SearchTopicPageResponse = SearchResponse<TopicPageHit>

export enum FilterType {
    COUNTRY = "country",
    TOPIC = "topic",
    QUERY = "query",
}

export enum SearchResultType {
    ALL = "all",
    DATA = "data",
    WRITING = "writing",
}

export type Filter = {
    type: FilterType
    name: string
}

export type SearchState = Readonly<{
    query: string
    filters: Filter[]
    requireAllCountries: boolean
    page: number
    resultType: SearchResultType
}>

type AddFilterAction = {
    type: "addFilter"
    filter: Filter
}
type RemoveFilterAction = {
    type: "removeFilter"
    filter: Filter
}
type SetTopicAction = {
    type: "setTopic"
    topic: string
}
type RemoveTopicAction = {
    type: "removeTopic"
    topic: string
}
type SetQueryAction = {
    type: "setQuery"
    query: string
}
type AddCountryAction = {
    type: "addCountry"
    country: string
}
type RemoveCountryAction = {
    type: "removeCountry"
    country: string
}
type ToggleRequireAllCountriesAction = {
    type: "toggleRequireAllCountries"
}
type SetStateAction = {
    type: "setState"
    state: SearchState
}
type SetPageAction = {
    type: "setPage"
    page: number
}
type ResetAction = {
    type: "reset"
}
type SetResultTypeAction = {
    type: "setResultType"
    resultType: SearchResultType
}

export type SearchAction =
    | AddFilterAction
    | RemoveFilterAction
    | AddCountryAction
    | SetTopicAction
    | RemoveCountryAction
    | RemoveTopicAction
    | SetPageAction
    | SetQueryAction
    | SetStateAction
    | ToggleRequireAllCountriesAction
    | ResetAction
    | SetResultTypeAction

export enum SearchTopicType {
    Topic = "topic",
    Area = "area",
}

export interface TemplateConfig {
    resultType: SearchResultType
    topicType: SearchTopicType | null
    hasCountry: boolean
    hasQuery: boolean
}

export type SearchFacetFilters = (string | string[])[]
