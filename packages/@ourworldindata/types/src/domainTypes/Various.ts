export type Integer = number

export type OwidVariableId = Integer // remove.

export type JsonString = string

/**
 * Pageview information about a single URL
 */
export interface RawPageview {
    day: Date
    url: string
    views_7d: number
    views_14d: number
    views_365d: number
}

export interface UserCountryInformation {
    code: string
    name: string
    short_code: string
    slug: string
    regions: string[] | null
}

export enum SiteFooterContext {
    gdocsDocument = "gdocsDocument", // the rendered version (on the site)
    grapherPage = "grapherPage",
    dataPageV2 = "dataPageV2",
    multiDimDataPage = "multiDimDataPage",
    dynamicCollectionPage = "dynamicCollectionPage",
    explorerPage = "explorerPage",
    default = "default",
    dataInsightsIndexPage = "data-insights-index-page",
    dataCatalogPage = "data-catalog-page",
}

export interface GitCommit {
    author_email: string
    author_name: string
    body: string
    date: string
    hash: string
    message: string
}
export interface SerializedGridProgram {
    slug: string
    program: string
    lastCommit?: GitCommit
}

export enum TaggableType {
    Charts = "charts",
}

// Exception format that can be easily given as an API error
export class JsonError extends Error {
    status: number
    constructor(message: string, status?: number) {
        super(message)
        this.status = status || 400
    }
}

export interface QueryParams {
    [key: string]: string | undefined
}

export enum R2GrapherConfigDirectory {
    byUUID = "config/by-uuid",
    publishedGrapherBySlug = "config/by-slug-published",
}
