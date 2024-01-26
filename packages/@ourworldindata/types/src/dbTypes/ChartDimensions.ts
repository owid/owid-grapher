export const ChartDimensionsTableName = "chart_dimensions"
export interface DbInsertChartDimension {
    chartId: number
    createdAt?: Date
    id?: number
    order: number
    property: string
    updatedAt?: Date | null
    variableId: number
}
export type DbPlainChartDimension = Required<DbInsertChartDimension>
