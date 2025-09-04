import { gdocUrlRegex } from "./GdocConstants.js"
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
import { z } from "zod/mini"

export interface FaqLink {
    gdocId: string
    fragmentId: string
}

export interface PrimaryTopic {
    topicTag: string
    citation: string
}

export interface DataInsightLink {
    title: string
    slug: string
    imgFilename?: string
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
    hasDataInsights?: boolean
    dataInsights?: DataInsightLink[]
}

export interface DataPageRelatedResearch {
    title: string
    url: string
    authors: string[]
    imageUrl: string
    tags: string[]
}

// This gives us a typed object we can use to validate datapage JSON files at runtime (see
// Value.Check() and Value.Errors() below), as well as a type that we can use
// for typechecking at compile time (see "type DataPageJson" below).

// We are using `strictObject` to enforce that we are not allowing any additional properties in
// the JSON file, in part because the JSON is added as-is to the page source for hydration,
// and we don't want to risk exposing unwanted draft or internal content.
export const DataPageJsonTypeObject = z.strictObject({
    showDataPageOnChartIds: z.array(z.number()),
    status: z.enum(["published", "draft"]),
    title: z.string(),
    googleDocEditLink: z.optional(z.string().check(z.regex(gdocUrlRegex))),
    topicTagsLinks: z.array(
        z.strictObject({ title: z.string(), url: z.string() })
    ),
    variantSource: z.optional(z.string()),
    variantMethods: z.optional(z.string()),
    nameOfSource: z.string(),
    owidProcessingLevel: z.string(),
    dateRange: z.string(),
    lastUpdated: z.string(),
    nextUpdate: z.string(),
    subtitle: z.optional(z.string()),
    descriptionFromSource: z.optional(
        z.strictObject({
            title: z.string(),
        })
    ),
    relatedResearch: z.optional(
        z.array(
            z.strictObject({
                title: z.string(),
                url: z.string(),
                authors: z.array(z.string()),
                imageUrl: z.string(),
            })
        )
    ),
    allCharts: z.optional(
        z.array(
            z.strictObject({
                title: z.string(),
                slug: z.string(),
            })
        )
    ),
    sources: z.array(
        z.strictObject({
            sourceName: z.string(),
            sourceRetrievedOn: z.optional(z.string()),
            sourceRetrievedFromUrl: z.optional(z.string()),
            sourceCitation: z.optional(z.string()),
        })
    ),
    citationDataInline: z.optional(z.string()),
    citationDataFull: z.optional(z.string()),
    citationDatapage: z.optional(z.string()),
})
export type DataPageJson = z.infer<typeof DataPageJsonTypeObject>

export type DataPageParseError = { message: string; path?: string }

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
    archivedChartInfo?: ArchiveContext
}

export interface DisplaySource {
    label: string
    description?: string
    dataPublishedBy?: string
    retrievedOn?: string
    retrievedFrom?: string
    citation?: string
}
