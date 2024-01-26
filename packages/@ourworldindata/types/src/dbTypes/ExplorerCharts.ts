export const ExplorerChartsTableName = "explorer_charts"
export interface DbInsertExplorerChart {
    chartId: number
    explorerSlug: string
    id?: number
}
export type DbPlainExplorerChart = Required<DbInsertExplorerChart>
