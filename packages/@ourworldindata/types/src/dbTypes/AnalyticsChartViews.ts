export const AnalyticsChartViewsTableName = "analytics_chart_views"

export type AnalyticsChartViewsType = "grapher_chart" | "explorer" | "multidim"

export interface DbPlainAnalyticsChartViewsRow {
    day: Date
    chart_slug: string
    view_config_id: string
    type: AnalyticsChartViewsType
    views_7d: number
    views_14d: number
    views_365d: number
}
