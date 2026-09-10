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
    allCharts: RelatedChart[] // Chart slugs
    source: OwidSource | undefined
    origins: OwidOrigin[]
    chartConfig: Record<string, unknown>
    license?: LicenseOption
    unit?: string
    unitConversionFactor?: number
    relatedChartsByCoview: RelatedChart[] // only needed for the new datapage design
    owners?: DatasetOwners[] // only needed for the new datapage design
    linkedAuthors?: LinkedAuthor[] // only needed for the new datapage design
}

export interface DataPageRelatedResearch {
    title: string
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

/**
 * One row of the collapsed metadata box's indicator list. When every pane of a
 * multi-indicator chart shares the same substantive metadata, the baker
 * collapses the switcher into a single pane plus this list; `short`, `unit`
 * and `note` are only set when that field differs across the indicators (the
 * shared value renders once in the pane instead).
 */
export interface CollapsedIndicatorListEntry {
    title: string
    short?: string
    unit?: string
    note?: string
}

export interface AdditionalIndicator {
    datapageData: DataPageDataV2
    faqEntries?: FaqEntryData
}

export interface DataPageV2ContentFields {
    datapageData: DataPageDataV2
    /**
     * Per-indicator metadata for the non-primary Y-indicators of a chart.
     * Populated at bake time only for charts enrolled in the data page metadata
     * experiment (see DATA_PAGE_METADATA_EXPERIMENT_ID); left undefined for
     * ordinary single-indicator data pages. The metadata box renders an
     * indicator switcher over `[primary, ...additionalIndicators]` when this is
     * non-empty.
     */
    additionalIndicators?: AdditionalIndicator[]
    /**
     * Set instead of `additionalIndicators` when the panes collapsed — see
     * CollapsedIndicatorListEntry. The metadata box renders one pane plus this
     * templated indicator list, and no switcher.
     */
    collapsedIndicatorList?: CollapsedIndicatorListEntry[]
    /**
     * Whether the page was baked with the redesigned data-page treatment
     * (metadata box etc.). Serialized so the client renders the same arm the
     * baker chose — recomputing the experiment gate client-side can disagree
     * with the baked HTML (e.g. after the experiment expires but before a
     * rebake) and cause a hydration mismatch. Optional only for pages baked
     * before this field existed; those fall back to recomputing.
     */
    useNewDatapageDesign?: boolean
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
    // Only the data-download readme reads these; the Sources UIs render the
    // fields above. They are here so both start from one shape.
    producer?: string
    datePublished?: string
    urlDownload?: string
    license?: OwidLicense
}
