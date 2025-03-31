export const FeaturedMetricsTableName = "featured_metrics"

export enum FeaturedMetricIncomeGroup {
    Low = "low",
    LowerMiddle = "lower-middle",
    UpperMiddle = "upper-middle",
    High = "high",
    All = "all",
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
