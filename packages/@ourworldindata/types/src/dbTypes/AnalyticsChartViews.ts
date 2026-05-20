export const AnalyticsChartViewsTableName = "analytics_chart_views"

export interface DbPlainAnalyticsChartViewsRow {
    day: Date
    chart_slug: string
    view_config_id: string
    type: string
    views_7d: number
    views_14d: number
    views_365d: number
}
