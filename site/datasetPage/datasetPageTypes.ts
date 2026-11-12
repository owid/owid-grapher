// Types for the dataset page: a page about a whole published dataset, built
// from the page files the ETL publishes for it (see
// baker/datasetPage/datasetPageFiles.ts). A dataset has one or more tables;
// the page currently shows the first one.

export interface DatasetIndicator {
    /** Column name in the downloaded table, e.g. `biofuel_elec_per_capita` */
    shortName: string
    title: string
    /** One-line description shown under the title */
    description: string
    unit?: string
    /** e.g. "1900–2025" */
    dateRange?: string
    /** Longer description (markdown) shown when the row is expanded */
    descriptionLong?: string
    /** Labels of the sources, as in DatasetSource.title */
    sourceNames: string[]
}

export interface DatasetIndicatorGroup {
    id: string
    title: string
    indicators: DatasetIndicator[]
}

export interface DatasetChartView {
    /** Grapher `tab` param, e.g. "map", "line", "discrete-bar" */
    tab: string
    label: string
}

/** A view of a multi-dim that uses the table's indicators */
export interface DatasetMultiDimView {
    title: string
    /** Slug and query, relative to the grapher base URL, e.g. "energy-mix?metric=total&source=coal" */
    grapherPath: string
    views: DatasetChartView[]
    /** Columns of the table that the view uses */
    indicatorShortNames: string[]
}

export interface DatasetChart {
    title: string
    /** Slug and optional query, relative to the grapher base URL, e.g. "energy-mix?metric=total" */
    grapherPath: string
    isMultiDim: boolean
    sourceText: string
    views: DatasetChartView[]
    /** Columns of the table that the chart (or any view of a multi-dim) uses */
    indicatorShortNames: string[]
    /** For a multi-dim: its views that use the table's indicators, in the order of its config */
    multiDimViews?: DatasetMultiDimView[]
}

export interface DatasetSource {
    title: string
    producer: string
    year?: number
    url: string
    /** Simple markdown */
    description: string
    citation: string
    /** ISO dates, e.g. "2026-04-21" */
    datePublished?: string
    dateAccessed?: string
    /** Link to download the source's original data, if available */
    downloadUrl?: string
}

export interface DatasetChangelogEntry {
    date: string
    /** Each change is simple markdown (inline code and links are supported) */
    changes: string[]
}

export interface DatasetRelatedResearch {
    title: string
    description: string
    url: string
    imageUrl: string
}

export type DatasetDownloadFormat = "csv" | "xlsx" | "parquet"

export interface DatasetDownloadFile {
    format: DatasetDownloadFormat
    sizeBytes: number
    latestUrl: string
    /** The same file of this version, if it is published */
    versionedUrl?: string
}

export interface DatasetAuxiliaryFile {
    label: string
    latestUrl: string
    versionedUrl?: string
}

export interface DatasetTable {
    name: string
    title: string
    /** Markdown */
    description?: string
    numRows: number
    numColumns: number
    /** Number of columns that aren't part of the primary key */
    numIndicators: number
    /** Columns that identify a row, e.g. ["country", "year"], if known */
    primaryKey?: string[]
    /** e.g. "1900–2025" */
    dateRange?: string
    citation?: string
    indicatorGroups: DatasetIndicatorGroup[]
    sources: DatasetSource[]
    charts: DatasetChart[]
    downloads: DatasetDownloadFile[]
    auxiliaryFiles: DatasetAuxiliaryFile[]
}

export interface DatasetPageData {
    /** e.g. "energy/owid_energy" */
    slug: string
    title: string
    description: string
    managedBy?: {
        name: string
        url?: string
        /** Photo from the owner's team page, if they have one */
        imageUrl?: string
    }
    /** e.g. "September 10, 2026" */
    lastUpdated?: string
    nextUpdate?: string
    version: string
    tables: DatasetTable[]
    relatedResearch: DatasetRelatedResearch[]
    changelog: DatasetChangelogEntry[]
    sourceCodeUrl: string
    readmeUrl?: string
    jsonLdUrl?: string
}
