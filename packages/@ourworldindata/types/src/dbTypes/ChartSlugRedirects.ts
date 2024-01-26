export const ChartSlugRedirectsTableName = "chart_slug_redirects"
export interface DbInsertChartSlugRedirect {
    chart_id: number
    createdAt?: Date
    id?: number
    slug: string
    updatedAt?: Date | null
}
export type DbPlainChartSlugRedirect = Required<DbInsertChartSlugRedirect>
