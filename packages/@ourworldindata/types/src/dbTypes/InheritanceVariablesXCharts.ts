export const InheritanceVariablesXChartsTableName =
    "inheritance_variables_x_charts"

export interface DbInsertInheritanceVariablesXCharts {
    variableId: number
    chartId: number
}

export type DbPlainInheritingChart =
    Required<DbInsertInheritanceVariablesXCharts>
