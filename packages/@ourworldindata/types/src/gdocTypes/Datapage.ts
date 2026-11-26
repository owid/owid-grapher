import { OwidOrigin } from "../OwidOrigin.js"
import { OwidSource } from "../OwidSource.js"
import {
    IndicatorTitleWithFragments,
    OwidLicense,
    OwidProcessingLevel,
} from "../OwidVariable.js"
import { LicenseOption, RelatedChart } from "../grapherTypes/GrapherTypes.js"
import { OwidEnrichedGdocBlock } from "./ArchieMlComponents.js"
import { ImageMetadata } from "./Image.js"
import { ArchiveContext } from "../domainTypes/Archive.js"
import { LinkedAuthor } from "./Gdoc.js"

export interface FaqLink {
    gdocId: string
    fragmentId: string
}

export interface PrimaryTopic {
    topicTag: string
    citation: string
}

export interface DatasetOwners {
    datasetId: number
    datasetName: string
    /** First entry is the accountable owner / point of contact. */
    owners: string[]
}

export interface DataPageDataV2 {
    status: "published" | "draft"
    title: IndicatorTitleWithFragments
    /**
     * The chart author's name for this indicator's dimension, on a chart with
     * several indicators. The indicator switcher prefers it to the title, so
     * that its menu matches the chart's legend.
     */
    chartDimensionName?: string
    /** Set on the pane of a scatter plot's bubble-size or colour indicator. */
    auxiliaryRole?: AuxiliaryIndicatorRole
    titleVariant?: string
    attributionShort?: string
    topicTagsLinks?: string[]
    primaryTopic?: PrimaryTopic
    attributions: string[]
    description?: string
    descriptionShort?: string
    descriptionFromProducer?: string
    descriptionKey?: string
    descriptionProcessing?: string
    owidProcessingLevel?: OwidProcessingLevel
    dateRange: string
    lastUpdated: string
    nextUpdate?: string
    relatedResearch: DataPageRelatedResearch[]
    source: OwidSource | undefined
    origins: OwidOrigin[]
    chartConfig: Record<string, unknown>
    license?: LicenseOption
    unit?: string
    unitConversionFactor?: number
    relatedCharts: RelatedChart[] // related-chart cards: coviews, then topic fallbacks
    owners?: DatasetOwners[]
    linkedAuthors?: LinkedAuthor[]
}

export interface DataPageRelatedResearch {
    title: string
    excerpt?: string
    url: string
    authors: string[]
    imageUrl: string
    tags: string[]
}

// TODO: https://github.com/owid/owid-grapher/issues/3426
export type FaqEntryData = {
    faqs: OwidEnrichedGdocBlock[]
}

export type Distribution =
    | { allowed: true }
    | { allowed: false; sourceLinks: string[] }

/** What a scatter plot uses an indicator for besides its axes. */
export type AuxiliaryIndicatorRole = "size" | "color"

/** One indicator's pane in the metadata box of a chart with several indicators. */
export interface IndicatorPaneData {
    datapageData: DataPageDataV2
    faqEntries?: FaqEntryData
}

/**
 * One indicator of a stitched metadata box, whose single pane shows what the
 * indicators share. Every field but the title is set only when it differs
 * between the indicators.
 */
export interface StitchedIndicator {
    title: string
    titleVariant?: string
    descriptionShort?: string
    unit?: string
    descriptionKey?: string
    dateRange?: string
    descriptionFromProducer?: string
}

/** One indicator's link and citation for a data source several indicators share. */
export interface IndicatorSourceLink {
    /** The indicator's title */
    label: string
    retrievedFrom?: string
    citation?: string
}

/** Each indicator's link and citation for one source of a stitched pane. */
export interface SourceLinksByIndicator {
    /** The source's index in the pane's origins */
    originIndex: number
    links: IndicatorSourceLink[]
}

/**
 * How the metadata box documents a chart with several indicators. When they
 * share their sources, processing and FAQs the baker stitches them into one
 * pane; otherwise each indicator gets a pane and the box a switcher.
 */
export type MultiIndicatorMetadata =
    | {
          type: "switcher"
          /** The panes after the primary indicator's, in display order */
          additionalPanes: IndicatorPaneData[]
      }
    | {
          type: "stitched"
          indicators: StitchedIndicator[]
          /** False when the list would only repeat the chart's legend */
          showIndicatorList: boolean
          /** Only for sources whose link or citation differs between the indicators */
          sourceLinksByIndicator?: SourceLinksByIndicator[]
      }

export interface DataPageV2ContentFields {
    datapageData: DataPageDataV2
    /** Set when the chart has more than one indicator to document */
    multiIndicator?: MultiIndicatorMetadata
    faqEntries: FaqEntryData | undefined
    // TODO: add gdocs for FAQs
    isPreviewing?: boolean
    canonicalUrl: string
    imageMetadata: Record<string, ImageMetadata>
    archiveContext?: ArchiveContext
    distribution: Distribution
}

export interface DisplaySource {
    label: string
    description?: string
    dataPublishedBy?: string
    retrievedOn?: string
    retrievedFrom?: string
    citation?: string
    /**
     * Each indicator's own link and citation, on a stitched page where they
     * differ. The Sources UI then shows these in place of retrievedFrom and
     * citation.
     */
    indicatorLinks?: IndicatorSourceLink[]
    // Only the data-download readme reads these; the Sources UIs render the
    // fields above. They are here so both start from one shape.
    producer?: string
    datePublished?: string
    urlDownload?: string
    license?: OwidLicense
}
