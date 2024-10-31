import { PageType } from "../../../site/search/searchTypes.js"

/** Pages */
export interface TypeAndImportance {
    type: PageType
    importance: number
}

/** Charts */
export interface RawChartRecordRow {
    id: number
    slug: string
    title: string
    variantName: string
    subtitle: string
    numDimensions: string
    publishedAt: string
    updatedAt: string
    entityNames: string
    tags: string
    keyChartForTags: string
}

export interface ParsedChartRecordRow {
    id: number
    slug: string
    title: string
    variantName: string
    subtitle: string
    numDimensions: string
    publishedAt: string
    updatedAt: string
    entityNames: string[]
    tags: string[]
    keyChartForTags: string[]
}

/** Explorers */
export interface ExplorerViewEntry {
    viewTitle: string
    viewSubtitle: string
    viewSettings: string[]
    viewQueryParams: string
    availableEntities: string[]

    viewGrapherId?: number
    yVariableIds: Array<string | number> // Variable IDs or ETL paths
    tableSlug?: string
    ySlugs: string[]

    /**
     * We often have several views with the same title within an explorer, e.g. "Population".
     * In order to only display _one_ of these views in search results, we need a way to demote duplicates.
     * This attribute is used for that: The highest-scored such view will be given a value of 0, the second-highest 1, etc.
     */
    viewTitleIndexWithinExplorer: number

    // Potential ranking criteria
    viewIndexWithinExplorer: number
    titleLength: number
    numNonDefaultSettings: number
    // viewViews_7d: number
}

export interface ExplorerViewEntryWithExplorerInfo extends ExplorerViewEntry {
    explorerSlug: string
    explorerTitle: string
    explorerSubtitle: string
    explorerViews_7d: number
    viewTitleAndExplorerSlug: string // used for deduplication: `viewTitle | explorerSlug`
    numViewsWithinExplorer: number
    tags: string[]

    score: number

    objectID?: string
}

export interface IndicatorMetadata {
    entityNames: string[]
    titlePublic?: string
    display?: { name: string }
    name: string
    descriptionShort?: string
}

export interface GrapherInfo {
    id: number
    title: string
    subtitle: string
}
