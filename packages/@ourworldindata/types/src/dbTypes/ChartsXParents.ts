export const ChartsXParentsTableName = "charts_x_parents"

export interface DbInsertChartXParent {
    chartId: number
    variableId: number
}

export type DbPlainChartXParent = Required<DbInsertChartXParent>
