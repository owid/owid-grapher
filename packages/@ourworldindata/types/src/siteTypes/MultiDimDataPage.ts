import { OwidEnrichedGdocBlock } from "../gdocTypes/ArchieMlComponents.js"
import {
    DataPageDataV2,
    DataPageRelatedResearch,
    PrimaryTopic,
} from "../gdocTypes/Datapage.js"
import { ImageMetadata } from "../gdocTypes/Image.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"
import {
    FaqLink,
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

// Prototype for the mdim-downloads project: describes a pre-built "download
// the complete dataset" package (all views/dimension combinations), as
// opposed to the existing per-view download which only covers whichever
// view is currently loaded.
//
// This is the stored/DB shape -- ETL writes csvUrl/indicatorsUrl/counts only.
// `url` is never stored; it's computed client-side from the page's own slug
// (see MultiDimDataPageContent.tsx), so it always points at the dynamic
// build route rather than a URL that could go stale. Consumers that need
// the resolved link (e.g. DownloadSection's button) should type their prop
// as `DownloadPackage & { url: string }`.
export interface DownloadPackage {
    url?: string
    // ETL-staged wide CSV + indicator index (R2) that the dynamic build
    // route reads from on every request -- the "complete dataset" analogue
    // of a chart's own data, fetched once at ETL publish time rather than
    // per-view.
    csvUrl?: string
    indicatorsUrl?: string
    indicatorCount?: number
    rowCount?: number
}

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
    downloadPackage?: DownloadPackage
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

// The resolved target of an explorer→multi-dim redirect, stored in the leaves of
// the baked explorer redirect decision trees (see baker/redirectsFromDb.ts). A
// `null` value in targetQueryParams means the param should be removed from the
// outgoing URL; a string value means it should be set to that value.
export interface ExplorerRedirectTarget {
    targetSlug: string
    targetQueryParams: Record<string, string | null>
}

export type FaqEntryKeyedByGdocIdAndFragmentId = {
    faqs: Record<string, Record<string, OwidEnrichedGdocBlock[]>>
}

export interface MultiDimDataPageInitialViewData extends DataPageDataV2 {
    faqs: FaqLink[]
}

export interface MultiDimDataPageProps {
    baseUrl: string
    canonicalUrl: string
    slug: string | null
    configObj: MultiDimDataPageConfigEnriched
    initialViewData?: MultiDimDataPageInitialViewData
    initialViewDimensions?: MultiDimDimensionChoices
    tagToSlugMap?: Record<string, string>
    faqEntries?: FaqEntryKeyedByGdocIdAndFragmentId
    primaryTopic?: PrimaryTopic
    relatedResearchCandidates: DataPageRelatedResearch[]
    imageMetadata: Record<string, ImageMetadata>
    isPreviewing?: boolean
    archiveContext?: ArchiveContext
}
