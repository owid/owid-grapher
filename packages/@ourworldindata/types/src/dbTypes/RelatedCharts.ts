export const RelatedChartsTableName = "related_charts"
export interface DbInsertRelatedChart {
    id?: number
    chartId: number
    relatedChartId: number
    label: string
    reviewer: string
    score?: number | null
    updatedAt?: Date
}

export type DbPlainRelatedChart = Required<DbInsertRelatedChart>
