import { JsonString } from "../domainTypes/Various.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"

export const NarrativeChartsTableName = "narrative_charts"
export interface DbInsertNarrativeChart {
    id?: number
    name: string
    chartConfigId: string
    parentChartId?: number | null
    parentMultiDimXChartConfigId?: number | null
    queryParamsForParentChart?: JsonString | null
    createdAt?: Date | null
    updatedAt?: Date | null
    lastEditedByUserId: number
}
export type DbPlainNarrativeChart = Required<DbInsertNarrativeChart>

// These props of the config object are _always_ explicitly persisted
// in the narrative chart's config, and thus cannot be accidentally overridden by
// an update to the parent chart's config.
export const NARRATIVE_CHART_PROPS_TO_PERSIST: (keyof GrapherInterface)[] = [
    // Chart type
    "chartTypes",
    "tab",

    // Entity selection
    "selectedEntityNames",
    "selectedEntityColors",

    // Time selection
    "minTime",
    "maxTime",

    // Focus state
    "focusedSeriesNames",
]

export const NARRATIVE_CHART_PROPS_TO_OMIT: (keyof GrapherInterface)[] = [
    "id",
    "isPublished",
    "slug",
    "version",
]
