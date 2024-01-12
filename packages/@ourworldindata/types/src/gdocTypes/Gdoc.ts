import { Tag } from "../dbTypes/Tags.js"
import { RelatedChart } from "../grapherTypes/GrapherTypes.js"
import { BreadcrumbItem } from "../domainTypes/Site.js"
import { TocHeadingWithTitleSupertitle } from "../domainTypes/Toc.js"
import { ImageMetadata } from "./Image.js"
import {
    EnrichedBlockText,
    EnrichedBlockWithParseErrors,
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
    RawBlockText,
    RefDictionary,
} from "./ArchieMlComponents.js"

export enum OwidGdocPublicationContext {
    unlisted = "unlisted",
    listed = "listed",
}

// A minimal object containing metadata needed for rendering prominent links etc in the client
export interface LinkedChart {
    originalSlug: string
    resolvedUrl: string
    title: string
    thumbnail?: string
}

export enum OwidGdocType {
    Article = "article",
    TopicPage = "topic-page",
    Fragment = "fragment",
    LinearTopicPage = "linear-topic-page",
    DataInsight = "data-insight",
}

export interface OwidGdocBaseInterface {
    id: string
    slug: string
    content: Record<string, any>
    published: boolean
    createdAt: Date
    publishedAt: Date | null
    updatedAt: Date | null
    revisionId: string | null
    publicationContext: OwidGdocPublicationContext
    breadcrumbs?: BreadcrumbItem[] | null
    linkedDocuments?: Record<string, OwidGdocBaseInterface>
    linkedCharts?: Record<string, LinkedChart>
    imageMetadata?: Record<string, ImageMetadata>
    relatedCharts?: RelatedChart[]
    tags?: Tag[]
    errors?: OwidGdocErrorMessage[]
}

export interface OwidGdocPostInterface extends OwidGdocBaseInterface {
    content: OwidGdocPostContent
    linkedDocuments?: Record<string, OwidGdocPostInterface>
}

export interface OwidGdocDataInsightContent {
    title: string
    authors: string[]
    ["grapher-url"]?: string
    ["approved-by"]: string // can't publish an insight unless this is set
    body: OwidEnrichedGdocBlock[]
    type: OwidGdocType.DataInsight
}

export const DATA_INSIGHTS_INDEX_PAGE_SIZE = 20

export interface OwidGdocDataInsightInterface extends OwidGdocBaseInterface {
    content: OwidGdocDataInsightContent
    linkedDocuments?: Record<string, OwidGdocPostInterface>
    latestDataInsights?: MinimalDataInsightInterface[]
    tags?: Tag[]
}

export type MinimalDataInsightInterface = Pick<
    OwidGdocDataInsightContent,
    "title"
> & {
    publishedAt: string
    // We select the 5 most recently published insights
    // We only display 4, but if you're on the DI page for one of them we hide it and show the next most recent
    index: 0 | 1 | 2 | 3 | 4
}

export type OwidGdoc = OwidGdocPostInterface | OwidGdocDataInsightInterface

export enum OwidGdocErrorMessageType {
    Error = "error",
    Warning = "warning",
}

export type OwidGdocProperty =
    | keyof OwidGdocPostInterface
    | keyof OwidGdocPostContent
    | keyof OwidGdocDataInsightInterface
    | keyof OwidGdocDataInsightContent
export type OwidGdocErrorMessageProperty =
    | OwidGdocProperty
    | `${OwidGdocProperty}${string}` // also allows for nesting, like `breadcrumbs[0].label`
export interface OwidGdocErrorMessage {
    property: OwidGdocErrorMessageProperty
    type: OwidGdocErrorMessageType
    message: string
}

// see also: getOwidGdocFromJSON()
export interface OwidGdocJSON
    extends Omit<
        OwidGdocPostInterface,
        "createdAt" | "publishedAt" | "updatedAt"
    > {
    createdAt: string
    publishedAt: string | null
    updatedAt: string | null
}

export interface OwidGdocLinkJSON {
    source: Record<string, any>
    linkType: "gdoc" | "url" | "grapher" | "explorer"
    target: string
    componentType: string
    text: string
}

export interface OwidArticleBackportingStatistics {
    errors: { name: string; details: string }[]
    numErrors: number
    numBlocks: number
    htmlTagCounts: Record<string, number>
    wpTagCounts: Record<string, number>
}

export interface OwidGdocPostContent {
    body?: OwidEnrichedGdocBlock[]
    type?:
        | OwidGdocType.Article
        | OwidGdocType.TopicPage
        | OwidGdocType.LinearTopicPage
        // TODO: Fragments need their own OwidGdocFragment interface and flow in the UI
        // Historically they were treated the same as GdocPosts but not baked
        // In reality, they have multiple possible data structures in their content (details, faqs, frontPageConfig, etc)
        // We should be able to render these in the preview before publishing
        // We're keeping them in this union until we have time to sort this out
        | OwidGdocType.Fragment
    title?: string
    supertitle?: string
    subtitle?: string
    authors: string[]
    dateline?: string
    excerpt?: string
    refs?: { definitions: RefDictionary; errors: OwidGdocErrorMessage[] }
    summary?: EnrichedBlockText[]
    "hide-citation"?: boolean
    toc?: TocHeadingWithTitleSupertitle[]
    "cover-image"?: string
    "featured-image"?: string
    "atom-title"?: string
    "atom-excerpt"?: string
    "sidebar-toc"?: boolean
    "cover-color"?:
        | "sdg-color-1"
        | "sdg-color-2"
        | "sdg-color-3"
        | "sdg-color-4"
        | "sdg-color-5"
        | "sdg-color-6"
        | "sdg-color-7"
        | "sdg-color-8"
        | "sdg-color-9"
        | "sdg-color-10"
        | "sdg-color-11"
        | "sdg-color-12"
        | "sdg-color-13"
        | "sdg-color-14"
        | "sdg-color-15"
        | "sdg-color-16"
        | "sdg-color-17"
        | "amber"
    "sticky-nav"?: OwidGdocStickyNavItem[]
    details?: DetailDictionary
    // TODO: having both the unparsed and parsed variant on the same type is pretty crude
    // Consider moving faqs into body or splitting the types and creating
    // a parsed and an unparsed gdoc variant.
    faqs?: RawFaq[]
    parsedFaqs?: FaqDictionary
}

export type OwidGdocStickyNavItem = { target: string; text: string }

export type GdocsPatch = Partial<OwidGdocPostInterface>

export enum GdocsContentSource {
    Internal = "internal",
    Gdocs = "gdocs",
}

export const DYNAMIC_COLLECTION_PAGE_CONTAINER_ID = "dynamic-collection-page"

export type RawDetail = {
    id: string
    text: RawBlockText[]
}

export type EnrichedDetail = {
    id: string
    text: EnrichedBlockText[]
} & EnrichedBlockWithParseErrors

export type DetailDictionary = Record<string, EnrichedDetail>

export type RawFaq = {
    id: string
    content: OwidRawGdocBlock[]
}
export type EnrichedFaq = {
    id: string
    content: OwidEnrichedGdocBlock[]
} & EnrichedBlockWithParseErrors

export type FaqDictionary = Record<string, EnrichedFaq>
