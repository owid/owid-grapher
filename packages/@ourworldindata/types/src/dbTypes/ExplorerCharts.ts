export const ExplorerChartsRowTableName = "explorer_charts"
export interface ExplorerChartsRowForInsert {
    chartId: number
    explorerSlug: string
    id?: number
}
export type ExplorerChartsRow = Required<ExplorerChartsRowForInsert>
