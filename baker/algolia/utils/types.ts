import {
    DbEnrichedVariable,
    FeaturedMetricIncomeGroup,
} from "@ourworldindata/types"
import { ChartRecord } from "../../../site/search/searchTypes.js"
import { OwidIncomeGroupName } from "@ourworldindata/utils"

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
    // True when the record is the first view specified in the explorer's config
    // Used in order to downrank all other views for the same explorer in the data catalog
    isFirstExplorerView: boolean
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

// This is the final record we index to Algolia for the `explorer-views-and-charts` index
// These properties are only used in Algolia for ranking purposes.
// This type shouldn't be necessary in any client-side code.
export type FinalizedExplorerRecord = ChartRecord & {
    viewTitleIndexWithinExplorer: number
    isFirstExplorerView: boolean
}

/**
 * Maps OWID income groups to Featured Metric income groups.
 */
export const incomeGroupMap: Record<
    Exclude<FeaturedMetricIncomeGroup, FeaturedMetricIncomeGroup.All>,
    OwidIncomeGroupName
> = {
    [FeaturedMetricIncomeGroup.Low]: "OWID_LIC",
    [FeaturedMetricIncomeGroup.LowerMiddle]: "OWID_LMC",
    [FeaturedMetricIncomeGroup.UpperMiddle]: "OWID_UMC",
    [FeaturedMetricIncomeGroup.High]: "OWID_HIC",
}
