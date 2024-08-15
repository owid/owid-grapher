import {
    IndicatorTitleWithFragments,
    FaqEntryKeyedByGdocIdAndFragmentId,
    PrimaryTopic,
} from "@ourworldindata/types"

// Indicator ID, catalog path, or maybe an array of those
export type IndicatorEntryBeforePreProcessing = string | number | undefined
export type IndicatorEntryAfterPreProcessing = number | undefined // catalog paths have been resolved to indicator IDs

interface MultiDimDataPageConfigType<
    IndicatorType extends Record<string, any>,
> {
    title: IndicatorTitleWithFragments
    defaultSelection?: string[]
    topicTags?: string[]
    // commonIndicatorPathPrefix?: string
    dimensions: Dimension[]
    views: View<IndicatorType>[]
}

export type MultiDimDataPageConfigRaw =
    MultiDimDataPageConfigType<IndicatorsBeforePreProcessing>

export type MultiDimDataPageConfigPreProcessed =
    MultiDimDataPageConfigType<IndicatorsAfterPreProcessing>

export interface Dimension {
    slug: string
    name: string
    group?: string
    description?: string
    multi_select?: boolean
    choices: Choice[]
}

export interface ChoicesEnriched {
    choices: Choice[]
    choicesBySlug: Record<string, Choice>
    choicesByGroup: Record<string, Choice[]>
}

export type DimensionEnriched = Dimension & ChoicesEnriched

export interface Choice {
    slug: string
    name: string
    description?: string
    // multi_select?: boolean
}

export interface IndicatorsBeforePreProcessing {
    y: IndicatorEntryBeforePreProcessing | IndicatorEntryBeforePreProcessing[]
    x?: IndicatorEntryBeforePreProcessing
    size?: IndicatorEntryBeforePreProcessing
    color?: IndicatorEntryBeforePreProcessing
}

export interface IndicatorsAfterPreProcessing {
    y: IndicatorEntryAfterPreProcessing[]
    x?: IndicatorEntryAfterPreProcessing
    size?: IndicatorEntryAfterPreProcessing
    color?: IndicatorEntryAfterPreProcessing
}

export interface View<IndicatorsType extends Record<string, any>> {
    dimensions: MultiDimDimensionChoices
    indicators: IndicatorsType
    config?: Config
}

export interface Config {
    title?: string
    subtitle?: string
}

export type MultiDimDimensionChoices = Record<string, string> // Keys: dimension slugs, values: choice slugs

export interface MultiDimDataPageProps {
    configObj: MultiDimDataPageConfigPreProcessed
    tagToSlugMap?: Record<string, string>
    faqEntries?: FaqEntryKeyedByGdocIdAndFragmentId
    primaryTopic?: PrimaryTopic | undefined

    initialQueryStr?: string
    canonicalUrl?: string
    isPreviewing?: boolean
}
