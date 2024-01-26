export const ChartDimensionsTableName = "chart_dimensions"
export interface ChartDimensionsRowForInsert {
    chartId: number
    createdAt?: Date
    id?: number
    order: number
    property: string
    updatedAt?: Date | null
    variableId: number
}
export type ChartDimensionsRow = Required<ChartDimensionsRowForInsert>
