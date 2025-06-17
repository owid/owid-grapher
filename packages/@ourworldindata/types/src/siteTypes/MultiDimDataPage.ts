import { OwidEnrichedGdocBlock } from "../gdocTypes/ArchieMlComponents.js"
import { DataPageRelatedResearch, PrimaryTopic } from "../gdocTypes/Datapage.js"
import { ImageMetadata } from "../gdocTypes/Image.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"
import {
    IndicatorTitleWithFragments,
    OwidVariableWithSource,
} from "../OwidVariable.js"
import { ArchiveContext } from "../domainTypes/Archive.js"

export type IndicatorConfig = Pick<OwidVariableWithSource, "id" | "display">
type IndicatorConfigByPath = Pick<IndicatorConfig, "display"> & {
    catalogPath: string
}

type IndicatorConfigBeforePreProcessing =
    | IndicatorConfig
    | IndicatorConfigByPath

// Indicator ID, catalog path or a an object
export type IndicatorEntryBeforePreProcessing =
    | string
    | number
    | IndicatorConfigBeforePreProcessing

// Catalog paths have been resolved to indicator IDs
export type IndicatorEntryAfterPreProcessing = IndicatorConfig

type Metadata = Omit<OwidVariableWithSource, "id">

interface MultiDimDataPageConfigType<
    IndicatorType extends Record<string, any>,
> {
    grapherConfigSchema?: string
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
    baseUrl: string
    canonicalUrl: string
    slug: string | null
    configObj: MultiDimDataPageConfigEnriched
    tagToSlugMap?: Record<string, string>
    faqEntries?: FaqEntryKeyedByGdocIdAndFragmentId
    primaryTopic?: PrimaryTopic
    relatedResearchCandidates: DataPageRelatedResearch[]
    imageMetadata: Record<string, ImageMetadata>
    isPreviewing?: boolean
    archivedChartInfo?: ArchiveContext
}
