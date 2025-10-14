import {
    DbEnrichedVariable,
    FeaturedMetricIncomeGroup,
    GrapherInterface,
    GrapherTabName,
} from "@ourworldindata/types"
import { ChartRecord, ExplorerType } from "../../../site/search/searchTypes.js"
import { OwidIncomeGroupName } from "@ourworldindata/utils"

/** Charts */
export interface RawChartRecordRow {
    id: number
    slug: string
    config: string
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
    config: GrapherInterface
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
    explorerType: ExplorerType
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
    viewAvailableTabs?: GrapherTabName[]
    ySlugs: Array<string>
    yVariableIds: Array<number | string>
    explorerSlug: string
    // True when the record is the first view specified in the explorer's config
    // Used in order to downrank all other views for the same explorer in the data catalog
    isFirstExplorerView: boolean
}

export type GrapherUnenrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    explorerType: ExplorerType.Grapher
    viewGrapherId: number
}

export type GrapherEnrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    explorerType: ExplorerType.Grapher
    viewTitle: string
    viewSubtitle: string
    titleLength: number
}

export type IndicatorUnenrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    explorerType: ExplorerType.Indicator
    viewGrapherId: never
    ySlugs: []
    tableSlug: never
}

export type IndicatorEnrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    explorerType: ExplorerType.Indicator
    viewGrapherId: never
    ySlugs: string[]
    tableSlug: never
    availableEntities: string[]
    titleLength: number
}

export type CsvUnenrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    explorerType: ExplorerType.Csv
    viewGrapherId: never
    ySlugs: string[]
    tableSlug: string
}

export type CsvEnrichedExplorerViewRecord = ExplorerViewBaseRecord & {
    explorerType: ExplorerType.Csv
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
    explorerType: ExplorerType
    viewTitleIndexWithinExplorer: number
    isFirstExplorerView: boolean
}

export const REAL_FM_INCOME_GROUPS: Exclude<
    FeaturedMetricIncomeGroup,
    FeaturedMetricIncomeGroup.Default
>[] = [
    FeaturedMetricIncomeGroup.Low,
    FeaturedMetricIncomeGroup.LowerMiddle,
    FeaturedMetricIncomeGroup.UpperMiddle,
    FeaturedMetricIncomeGroup.High,
]

/**
 * Maps OWID income groups to Featured Metric income groups.
 */
export const incomeGroupMap: Record<
    Exclude<FeaturedMetricIncomeGroup, FeaturedMetricIncomeGroup.Default>,
    OwidIncomeGroupName
> = {
    [FeaturedMetricIncomeGroup.Low]: "OWID_LIC",
    [FeaturedMetricIncomeGroup.LowerMiddle]: "OWID_LMC",
    [FeaturedMetricIncomeGroup.UpperMiddle]: "OWID_UMC",
    [FeaturedMetricIncomeGroup.High]: "OWID_HIC",
}
