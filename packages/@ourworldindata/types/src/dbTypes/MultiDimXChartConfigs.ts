export const MultiDimXChartConfigsTableName = "multi_dim_x_chart_configs"

export type DbInsertMultiDimXChartConfig = {
    multiDimId: number
    viewId: string
    variableId: number
    chartConfigId: string
    createdAt?: Date
    updatedAt?: Date
}

export type DbPlainMultiDimXChartConfig =
    Required<DbInsertMultiDimXChartConfig> & {
        id: number
    }
