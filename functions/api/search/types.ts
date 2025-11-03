// Types copied from site/search/searchTypes.ts to avoid cross-package imports
// These are the minimal types needed for the search API

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

export enum SearchIndexName {
    Charts = "charts",
    Pages = "pages",
    ExplorerViewsMdimViewsAndCharts = "explorer-views-and-charts",
}

export enum FilterType {
    COUNTRY = "country",
    TOPIC = "topic",
    QUERY = "query",
}

export type Filter = {
    type: FilterType
    name: string
}

interface BaseSearchChartHit {
    title: string
    slug: string
    availableEntities: string[]
    originalAvailableEntities?: string[]
    availableTabs?: string[]
    objectID: string
    variantName?: string
    subtitle?: string
    __position: number
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

/**
 * Enriched search result with URL added
 * This is what we return from the API after processing Algolia results
 */
export type EnrichedSearchChartHit = Omit<
    SearchChartHit,
    "objectID" | "_highlightResult" | "_snippetResult"
> & {
    url: string
}

/**
 * Page search hit from Algolia
 */
export interface SearchPageHit {
    title: string
    slug: string
    type: string
    thumbnailUrl?: string
    date?: string
    content?: string
    authors?: string[]
    objectID: string
    __position: number
}

/**
 * Enriched page search result with URL added
 */
export type EnrichedSearchPageHit = Omit<
    SearchPageHit,
    "objectID" | "_highlightResult" | "_snippetResult"
> & {
    url: string
}
