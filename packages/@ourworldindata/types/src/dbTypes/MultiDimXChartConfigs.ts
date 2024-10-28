export const MultiDimXChartConfigsTableName = "multi_dim_x_chart_configs"

export type DbInsertMultiDimXChartConfig = {
    multiDimId: number
    variableId: number
    chartConfigId: string
    createdAt?: Date
    updatedAt?: Date
}
