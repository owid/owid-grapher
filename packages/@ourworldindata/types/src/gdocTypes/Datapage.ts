import { OwidOrigin } from "../OwidOrigin.js"
import { OwidSource } from "../OwidSource.js"
import {
    IndicatorTitleWithFragments,
    OwidProcessingLevel,
} from "../OwidVariable.js"
import { RelatedChart } from "../grapherTypes/GrapherTypes.js"
import { OwidEnrichedGdocBlock } from "./ArchieMlComponents.js"
import { ImageMetadata } from "./Image.js"
import { ArchiveContext } from "../domainTypes/Archive.js"

export interface FaqLink {
    gdocId: string
    fragmentId: string
}

export interface PrimaryTopic {
    topicTag: string
    citation: string
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
    descriptionKey: string[]
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
    unit?: string
    unitConversionFactor?: number
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

export interface DataPageV2ContentFields {
    datapageData: DataPageDataV2
    faqEntries: FaqEntryData | undefined
    // TODO: add gdocs for FAQs
    isPreviewing?: boolean
    canonicalUrl: string
    tagToSlugMap: Record<string, string>
    imageMetadata: Record<string, ImageMetadata>
    archiveContext?: ArchiveContext
}

export interface DisplaySource {
    label: string
    description?: string
    dataPublishedBy?: string
    retrievedOn?: string
    retrievedFrom?: string
    citation?: string
}
