import { gdocUrlRegex } from "./GdocConstants.js"
import { OwidOrigin } from "../OwidOrigin.js"
import { OwidSource } from "../OwidSource.js"
import {
    IndicatorTitleWithFragments,
    OwidProcessingLevel,
} from "../OwidVariable.js"
import { RelatedChart } from "../grapherTypes/GrapherTypes.js"
import { Static, Type } from "@sinclair/typebox"
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

// This gives us a typed object we can use to validate datapage JSON files at runtime (see
// Value.Check() and Value.Errors() below), as well as a type that we can use
// for typechecking at compile time (see "type DataPageJson" below).
export const DataPageJsonTypeObject = Type.Object(
    {
        showDataPageOnChartIds: Type.Array(Type.Number()),
        status: Type.Union([Type.Literal("published"), Type.Literal("draft")]),
        title: Type.String(),
        googleDocEditLink: Type.Optional(Type.RegEx(gdocUrlRegex)),
        topicTagsLinks: Type.Array(
            Type.Object({ title: Type.String(), url: Type.String() })
        ),
        variantSource: Type.Optional(Type.String()),
        variantMethods: Type.Optional(Type.String()),
        nameOfSource: Type.String(),
        owidProcessingLevel: Type.String(),
        dateRange: Type.String(),
        lastUpdated: Type.String(),
        nextUpdate: Type.String(),
        subtitle: Type.Optional(Type.String()),
        descriptionFromSource: Type.Optional(
            Type.Object({
                title: Type.String(),
            })
        ),
        relatedResearch: Type.Optional(
            Type.Array(
                Type.Object({
                    title: Type.String(),
                    url: Type.String(),
                    authors: Type.Array(Type.String()),
                    imageUrl: Type.String(),
                })
            )
        ),
        allCharts: Type.Optional(
            Type.Array(
                Type.Object({
                    title: Type.String(),
                    slug: Type.String(),
                })
            )
        ),
        sources: Type.Array(
            Type.Object({
                sourceName: Type.String(),
                sourceRetrievedOn: Type.Optional(Type.String()),
                sourceRetrievedFromUrl: Type.Optional(Type.String()),
                sourceCitation: Type.Optional(Type.String()),
            })
        ),
        citationDataInline: Type.Optional(Type.String()),
        citationDataFull: Type.Optional(Type.String()),
        citationDatapage: Type.Optional(Type.String()),
    },
    // We are not allowing to have any additional properties in the JSON file,
    // in part because the JSON is added as-is to the page source for hydration,
    // and we don't want to risk exposing unwanted draft or internal content.

    // Todo: this doesn't to work for nested objects, even when adding
    // "additionalProperties" keys to each individual ones.
    { additionalProperties: false }
)
export type DataPageJson = Static<typeof DataPageJsonTypeObject>

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
