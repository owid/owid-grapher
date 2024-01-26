export const ChartSlugRedirectsTableName = "chart_slug_redirects"
export interface ChartSlugRedirectsRowForInsert {
    chart_id: number
    createdAt?: Date
    id?: number
    slug: string
    updatedAt?: Date | null
}
export type ChartSlugRedirectsRow = Required<ChartSlugRedirectsRowForInsert>
