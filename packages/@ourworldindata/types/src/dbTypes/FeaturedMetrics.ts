export const FeaturedMetricsTableName = "featured_metrics"

export enum FeaturedMetricIncomeGroup {
    All = "all",
    High = "high",
    UpperMiddle = "upper-middle",
    LowerMiddle = "lower-middle",
    Low = "low",
}

export interface DbInsertFeaturedMetric {
    id?: number
    url: string
    parentTagId: number
    ranking: number
    incomeGroup: FeaturedMetricIncomeGroup
}

export type DbPlainFeaturedMetric = Required<DbInsertFeaturedMetric>

export type DbPlainFeaturedMetricWithParentTagName = DbPlainFeaturedMetric & {
    parentTagName: string
}

export type FeaturedMetricByParentTagNameDictionary = Record<
    string,
    DbPlainFeaturedMetricWithParentTagName[]
>
