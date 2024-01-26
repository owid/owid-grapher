export const AnalyticsPageviewsTableName = "analytics_pageviews"
export interface AnalyticsPageviewsRow {
    day: Date
    url: string
    views_14d: number
    views_365d: number
    views_7d: number
}
