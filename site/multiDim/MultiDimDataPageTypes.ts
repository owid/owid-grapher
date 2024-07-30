import { IndicatorTitleWithFragments } from "@ourworldindata/types"

// Indicator ID, catalog path, or maybe an array of those
export type IndicatorEntryBeforePreProcessing = string | number | undefined
export type IndicatorEntryAfterPreProcessing = number | undefined // catalog paths have been resolved to indicator IDs
export type MultiIndicatorEntry<IndicatorType> = IndicatorType | IndicatorType[]

interface MultiDimDataPageConfigType<IndicatorType> {
    title: IndicatorTitleWithFragments
    defaultSelection?: string[]
    topicTags?: string[]
    // commonIndicatorPathPrefix?: string
    dimensions: Dimension[]
    views: View<IndicatorType>[]
}

export type MultiDimDataPageConfigRaw =
    MultiDimDataPageConfigType<IndicatorEntryBeforePreProcessing>

export type MultiDimDataPageConfigPreProcessed =
    MultiDimDataPageConfigType<IndicatorEntryAfterPreProcessing>

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

export interface View<IndicatorType> {
    dimensions: Record<string, string> // Keys: dimension slugs, values: choice slugs
    indicators: {
        y: MultiIndicatorEntry<IndicatorType>
        x?: IndicatorType
        size?: IndicatorType
        color?: IndicatorType
    }
    config?: Config
}

export interface Config {
    title?: string
    subtitle?: string
}
