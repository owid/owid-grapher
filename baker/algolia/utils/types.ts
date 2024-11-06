import { DbEnrichedVariable } from "@ourworldindata/types"
import { ChartRecord, PageType } from "../../../site/search/searchTypes.js"

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
export interface IndicatorMetadata {
    entityNames: string[]
    titlePublic?: string
    display?: { name: string }
    name: string
    descriptionShort?: string
}

export interface ExplorerViewGrapherInfo {
    id: number
    title: string
    subtitle: string
}

export type EntitiesByColumnDictionary = Record<
    string,
    Record<string, string[]>
>

export type ExplorerIndicatorMetadataFromDb = Pick<
    DbEnrichedVariable,
    | "id"
    | "catalogPath"
    | "name"
    | "titlePublic"
    | "display"
    | "descriptionShort"
>

export type ExplorerIndicatorMetadataDictionary = Record<
    string | number,
    ExplorerIndicatorMetadataFromDb & {
        entityNames?: string[]
    }
>

export interface ExplorerViewBaseRecord {
    availableEntities: string[]
    numNonDefaultSettings: number
    tableSlug?: string
    viewGrapherId?: number
    viewIndexWithinExplorer: number
    viewQueryParams: string
    // TODO: are nulls necessary here?
    viewSettings: Array<string | null>
    viewSubtitle?: string
    viewTitle?: string
    ySlugs: Array<string>
    yVariableIds: Array<number | string>
    explorerSlug: string
}

export type GrapherUnenrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    viewGrapherId: number
}

export type GrapherEnrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    viewTitle: string
    viewSubtitle: string
    titleLength: number
}

export type IndicatorUnenrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    viewGrapherId: never
    ySlugs: []
    tableSlug: never
}

export type IndicatorEnrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    viewGrapherId: never
    ySlugs: string[]
    tableSlug: never
    availableEntities: string[]
    titleLength: number
}

export type CsvUnenrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    viewGrapherId: never
    ySlugs: string[]
    tableSlug: string
}

export type CsvEnrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    viewGrapherId: never
    ySlugs: string[]
    tableSlug: string
    titleLength: number
}

export type EnrichedExplorerRecord =
    | GrapherEnrichedExplorerViewRecord
    | IndicatorEnrichedExplorerViewRecord
    | CsvEnrichedExplorerViewRecord

/** This is the final record we index to Algolia for the `explorer-views` index */
export interface ExplorerViewFinalRecord {
    objectID: string
    explorerTitle: string
    viewTitle: string
    viewSettings: string[]
    /**
     * We often have several views with the same title within an explorer, e.g. "Population".
     * In order to only display _one_ of these views in search results, we need a way to demote duplicates.
     * This attribute is used for that: The highest-scored such view will be given a value of 0, the second-highest 1, etc.
     */
    viewTitleIndexWithinExplorer: number
    score: number
    viewIndexWithinExplorer: number
    viewSubtitle: string
    viewQueryParams: string
    titleLength: number
    numNonDefaultSettings: number
    explorerSlug: string
    explorerSubtitle: string
    explorerViews_7d: number
    viewTitleAndExplorerSlug: string
    numViewsWithinExplorer: number
    // These 2 aren't currently used in the explorer-views index (used in /search), but we need them in the data catalog
    tags: string[]
    availableEntities: string[]
    // Only used to filter out these views from the data catalog (because we already index graphers)
    viewGrapherId?: number
}

// This is the final record we index to Algolia for the `explorer-views-and-charts` index
export type ConvertedExplorerChartHit = ChartRecord & {
    viewTitleIndexWithinExplorer: number
}
