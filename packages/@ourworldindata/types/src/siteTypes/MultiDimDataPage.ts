import { OwidEnrichedGdocBlock } from "../gdocTypes/ArchieMlComponents.js"
import { PrimaryTopic } from "../gdocTypes/Datapage.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"
import {
    IndicatorTitleWithFragments,
    OwidVariableWithSource,
} from "../OwidVariable.js"

// Indicator ID, catalog path, or maybe an array of those
export type IndicatorEntryBeforePreProcessing = string | number
export type IndicatorEntryAfterPreProcessing = number // catalog paths have been resolved to indicator IDs

type Metadata = Omit<OwidVariableWithSource, "id">

interface MultiDimDataPageConfigType<
    IndicatorType extends Record<string, any>,
> {
    title: IndicatorTitleWithFragments
    defaultSelection?: string[]
    topicTags?: string[]
    // commonIndicatorPathPrefix?: string
    dimensions: Dimension[]
    views: View<IndicatorType>[]
    metadata?: Metadata
}

export type MultiDimDataPageConfigRaw =
    MultiDimDataPageConfigType<IndicatorsBeforePreProcessing>

export type MultiDimDataPageConfigPreProcessed =
    MultiDimDataPageConfigType<IndicatorsAfterPreProcessing>

export type MultiDimDataPageConfigEnriched = Omit<
    MultiDimDataPageConfigPreProcessed,
    "views"
> & {
    views: ViewEnriched[]
}

export interface Dimension {
    slug: string
    name: string
    group?: string
    description?: string
    // multi_select?: boolean
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
    config?: GrapherInterface
    metadata?: Metadata
}

export interface ViewEnriched extends View<IndicatorsAfterPreProcessing> {
    fullConfigId: string
}

export type MultiDimDimensionChoices = Record<string, string> // Keys: dimension slugs, values: choice slugs

export type FaqEntryKeyedByGdocIdAndFragmentId = {
    faqs: Record<string, Record<string, OwidEnrichedGdocBlock[]>>
}

export interface MultiDimDataPageProps {
    configObj: MultiDimDataPageConfigEnriched
    tagToSlugMap?: Record<string, string>
    faqEntries?: FaqEntryKeyedByGdocIdAndFragmentId
    primaryTopic?: PrimaryTopic | undefined

    initialQueryStr?: string
    canonicalUrl?: string
    isPreviewing?: boolean
}
