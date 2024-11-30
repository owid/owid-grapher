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
