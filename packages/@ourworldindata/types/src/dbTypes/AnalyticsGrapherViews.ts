export const AnalyticsGrapherViewsTableName = "analytics_grapher_views"
export interface DbPlainAnalyticsGrapherView {
    day: Date
    grapher_slug: string
    views_7d: number
    views_14d: number
    views_365d: number
}
