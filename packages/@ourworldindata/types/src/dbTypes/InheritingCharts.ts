export const InheritingChartsTableName = "inheriting_charts"

export interface DbInsertInheritingChart {
    variableId: number
    chartId: number
}

export type DbPlainInheritingChart = Required<DbInsertInheritingChart>
