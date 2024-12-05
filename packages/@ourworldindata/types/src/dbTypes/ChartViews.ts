import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"

export const ChartViewsTableName = "chart_views"
export interface DbInsertChartView {
    id?: number
    name: string
    chartConfigId: string
    parentChartId: number
    createdAt?: Date | null
    updatedAt?: Date | null
    lastEditedByUserId: number
}
export type DbPlainChartView = Required<DbInsertChartView>

// These props of the config object are _always_ explicitly persisted
// in the chart view's config, and thus cannot be accidentally overridden by
// an update to the parent chart's config.
export const CHART_VIEW_PROPS_TO_PERSIST: (keyof GrapherInterface)[] = [
    // Chart type
    "chartTypes",
    "tab",

    // Entity selection
    "selectedEntityNames",
    "selectedEntityColors",

    // Time selection
    "minTime",
    "maxTime",
]

export const CHART_VIEW_PROPS_TO_OMIT: (keyof GrapherInterface)[] = [
    "id",
    "isPublished",
    "slug",
    "version",
]
