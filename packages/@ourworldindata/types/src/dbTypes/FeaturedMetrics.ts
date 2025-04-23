export const FeaturedMetricsTableName = "featured_metrics"

export enum FeaturedMetricIncomeGroup {
    Default = "default",
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

export type ExpandedFeaturedMetric = DbPlainFeaturedMetricWithParentTagName & {
    isIncomeGroupSpecificFM: boolean
}

export type FeaturedMetricByParentTagNameDictionary = Record<
    string,
    DbPlainFeaturedMetricWithParentTagName[]
>
