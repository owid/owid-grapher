export const ChartSlugRedirectsTableName = "chart_slug_redirects"
export interface DbInsertChartSlugRedirect {
    chart_id: number
    createdAt?: Date
    id?: number
    slug: string
    target_query_param?: string | null
    updatedAt?: Date
}
export type DbPlainChartSlugRedirect = Required<DbInsertChartSlugRedirect>
