export const AnalyticsGrapherViewsTableName = "analytics_grapher_views"
export interface DbPlainAnalyticsGrapherView {
    day: Date
    grapher_slug: string
    views_7d: number
    views_14d: number
    views_365d: number
}

export interface AnalyticsGrapherViewWithRank extends DbPlainAnalyticsGrapherView {
    rank_7d?: number
    rank_14d?: number
    rank_365d?: number
    total_charts?: number
}
