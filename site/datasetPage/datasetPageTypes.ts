// Types for the dataset page prototype. These describe a whole published
// dataset (one wide table), not a single indicator or chart. The shape is
// intentionally standalone for now: once the page is wired up to real data
// it should be derived from the ETL catalog / variables metadata instead.

export interface DatasetIndicator {
    /** Column name in the downloaded table, e.g. `biofuel_elec_per_capita` */
    shortName: string
    title: string
    /** One-line description shown under the title */
    description: string
    unit?: string
    /** Longer description shown when the row is expanded */
    descriptionLong?: string
    sourceNames?: string[]
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

export interface DatasetChart {
    title: string
    /** Path + query relative to /grapher, e.g. "energy-mix?metric=total" */
    grapherPath: string
    isMultiDim?: boolean
    sourceText: string
    views: DatasetChartView[]
}

export interface DatasetSource {
    title: string
    producer: string
    year: number
    url: string
    description: string
    citation: string
    dateAccessed?: string
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

export interface DatasetDownloadFile {
    format: "csv" | "excel" | "parquet"
    label: string
    size: string
    note?: string
    latestUrl: string
    versionedUrl: string
}

export interface DatasetAuxiliaryFile {
    label: string
    latestUrl: string
    versionedUrl: string
}

export interface DatasetPageData {
    slug: string
    title: string
    shortTitle: string
    description: string
    /** Paragraphs of simple markdown */
    about: string[]
    managedBy: { name: string; url: string }
    dateRange: string
    lastUpdated: string
    nextUpdate: string
    version: string
    numRows: number
    indicatorGroups: DatasetIndicatorGroup[]
    charts: DatasetChart[]
    relatedResearch: DatasetRelatedResearch[]
    sources: DatasetSource[]
    processingDescription: string
    changelog: DatasetChangelogEntry[]
    downloads: DatasetDownloadFile[]
    auxiliaryFiles: DatasetAuxiliaryFile[]
    sourceCodeUrl: string
    readmeUrl: string
    jsonLdUrl: string
    license: { name: string; url: string }
}
