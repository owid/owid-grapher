import type {
    SearchResponse,
    BaseHit,
    Hit,
    HitHighlightResult,
} from "instantsearch.js"
import { OwidGdocType } from "../gdocTypes/Gdoc.js"
import { GrapherTabName } from "../grapherTypes/GrapherTypes.js"
import * as z from "zod/mini"

export const PagesIndexRecordSchema = z.object({
    objectID: z.string(),
    importance: z.number(),
    type: z.enum(OwidGdocType),
    slug: z.string(),
    title: z.string(),
    content: z.string(),
    views_7d: z.number(),
    score: z.number(),
    excerpt: z.optional(z.string()),
    excerptLong: z.optional(z.array(z.string())),
    authors: z.optional(z.array(z.string())),
    date: z.optional(z.string()),
    modifiedDate: z.optional(z.string()),
    tags: z.optional(z.array(z.string())),
    thumbnailUrl: z.string(),
})

export type PageRecord = z.infer<typeof PagesIndexRecordSchema>

export const PagesIndexRecordsResponseSchema = z.object({
    records: z.array(PagesIndexRecordSchema),
    count: z.number(),
    message: z.optional(z.string()),
})

export type PagesIndexRecordsResponse = z.infer<
    typeof PagesIndexRecordsResponseSchema
>

export type IPageHit = PageRecord & Hit<BaseHit>

export enum ChartRecordType {
    Chart = "chart",
    ExplorerView = "explorerView",
    MultiDimView = "multiDimView",
}

export enum ExplorerType {
    Grapher = "grapher",
    Indicator = "indicator",
    Csv = "csv",
}

export interface ChartRecord {
    type: ChartRecordType
    objectID: string
    chartId: number
    chartConfigId?: string
    slug: string
    queryParams?: string
    title: string
    subtitle: string | undefined
    variantName: string
    availableTabs: GrapherTabName[]
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

interface BaseSearchChartHit {
    title: string
    slug: string
    availableEntities: string[]
    originalAvailableEntities?: string[]
    objectID: string
    variantName?: string
    subtitle?: string
    availableTabs: GrapherTabName[]
    __position: number
    _highlightResult?: HitHighlightResult
    _snippetResult?: HitHighlightResult
}

type SearchChartViewHit = BaseSearchChartHit & {
    type: ChartRecordType.Chart
}

type SearchExplorerViewHit = BaseSearchChartHit & {
    type: ChartRecordType.ExplorerView
    explorerType: ExplorerType
    queryParams: string
}

type SearchMultiDimViewHit = BaseSearchChartHit & {
    type: ChartRecordType.MultiDimView
    queryParams: string
    chartConfigId: string
}

/**
 * This is the type for the hits that we get back from algolia when we search
 * response.results[0].hits is an array of these
 */
export type SearchChartHit =
    | SearchChartViewHit
    | SearchExplorerViewHit
    | SearchMultiDimViewHit

export interface SearchChartHitComponentProps {
    hit: SearchChartHit
    selectedRegionNames?: string[] | undefined
    // Search uses a global onClick handler to track analytics
    // But the data catalog passes a function to this component explicitly
    onClick: (vizType: string | null) => void
}

export type SearchChartHitComponentVariant = "large" | "medium" | "small"

// SearchResponse adds the extra fields from Algolia: page, nbHits, etc
export type SearchChartsResponse = SearchResponse<SearchChartHit>

export type SearchDataTopicsResponse = {
    title: string
    charts: SearchResponse<SearchChartHit>
}

export type ScoredFilter = Filter & {
    name: string
    score: number
}

export type ScoredFilterPositioned = ScoredFilter & {
    positions: number[]
}

export type DataInsightHit = {
    title: string
    thumbnailUrl: string
    date: string
    slug: string
    type: OwidGdocType.DataInsight
    objectID: string
    __position: number
}

export type SearchDataInsightResponse = SearchResponse<DataInsightHit>

export type FlatArticleHit = {
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

export type StackedArticleHit = {
    title: string
    thumbnailUrl: string
    slug: string
    type: OwidGdocType.Article | OwidGdocType.AboutPage
    content: string
    objectID: string
    __position: number
}

export type SearchStackedArticleResponse = SearchResponse<StackedArticleHit>
export type SearchFlatArticleResponse = SearchResponse<FlatArticleHit>

export type TopicPageHit = {
    title: string
    type: OwidGdocType.TopicPage | OwidGdocType.LinearTopicPage
    slug: string
    excerpt: string
    excerptLong?: string[]
    objectID: string
    __position: number
}

export type SearchTopicPageResponse = SearchResponse<TopicPageHit>

export type SearchWritingTopicsResponse = {
    title: string
    articles: SearchStackedArticleResponse
    topicPages: SearchTopicPageResponse
    totalCount: number
}

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

export enum SearchUrlParam {
    COUNTRY = "countries",
    TOPIC = "topics",
    QUERY = "q",
    REQUIRE_ALL_COUNTRIES = "requireAllCountries",
    RESULT_TYPE = "resultType",
}

export type SearchState = Readonly<{
    query: string
    filters: Filter[]
    requireAllCountries: boolean
    resultType: SearchResultType
}>

export interface SearchActions {
    setQuery: (query: string) => void
    addCountry: (country: string) => void
    addCountryAndSetQuery: (country: string, query: string) => void
    removeCountry: (country: string) => void
    setTopic: (topic: string) => void
    setTopicAndClearQuery: (topic: string) => void
    removeTopic: (topic: string) => void
    addFilter: (filter: Filter) => void
    removeFilter: (filter: Filter) => void
    toggleRequireAllCountries: () => void
    setResultType: (resultType: SearchResultType) => void
    replaceQueryWithFilter: (filter: ScoredFilterPositioned) => void
    reset: () => void
}

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

export type SynonymMap = Map<string, string[]>

export interface WordPositioned {
    word: string
    position: number
}

export type Ngram = WordPositioned[]
