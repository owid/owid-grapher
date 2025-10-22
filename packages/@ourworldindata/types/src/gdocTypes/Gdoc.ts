import {
    GrapherChartOrMapType,
    GrapherTabConfigOption,
    RelatedChart,
} from "../grapherTypes/GrapherTypes.js"
import { BreadcrumbItem } from "../domainTypes/Site.js"
import { TocHeadingWithTitleSupertitle } from "../domainTypes/Toc.js"
import { ImageMetadata } from "./Image.js"
import {
    EnrichedBlockSocials,
    EnrichedBlockText,
    EnrichedBlockWithParseErrors,
    OwidEnrichedGdocBlock,
    OwidRawGdocBlock,
    RefDictionary,
} from "./ArchieMlComponents.js"
import { MinimalTag } from "../dbTypes/Tags.js"
import { DbEnrichedLatestWork } from "../domainTypes/Author.js"
import { QueryParams } from "../domainTypes/Various.js"
import { TagGraphRoot } from "../domainTypes/ContentGraph.js"
import { DbRawImage } from "../dbTypes/Images.js"
import { DbPlainNarrativeChart } from "../dbTypes/NarrativeCharts.js"
import { ArchivedPageVersion } from "../domainTypes/Archive.js"

export enum OwidGdocPublicationContext {
    unlisted = "unlisted",
    listed = "listed",
}

export interface LatestDataInsight {
    id: string
    slug: string
    publishedAt: Date | null
    content: OwidGdocDataInsightContent
    index?: number
}

export interface LinkedAuthor {
    name: string
    slug: string
    featuredImage: string | null
    updatedAt: Date
}

export enum ChartConfigType {
    Grapher = "grapher",
    Explorer = "explorer",
    MultiDim = "multi-dim",
}

// A minimal object containing metadata needed for rendering prominent links etc in the client
export interface LinkedChart {
    configType: ChartConfigType
    originalSlug: string
    resolvedUrl: string
    title: string
    subtitle?: string
    thumbnail?: string
    tags: string[]
    tab?: GrapherTabConfigOption
    indicatorId?: number // in case of a datapage
    archivedPageVersion?: ArchivedPageVersion | undefined
    dimensionSlugs?: string[] // for validating mdim links, to make sure the query params are correct
}

// An object containing metadata needed for embedded narrative charts
export interface NarrativeChartInfo {
    name: string
    title: string
    chartConfigId: string
    parentChartSlug: string
    queryParamsForParentChart: QueryParams
}

/**
 * A linked indicator is derived from a linked grapher's config (see: getVariableOfDatapageIfApplicable)
 * e.g. https://ourworldindata.org/grapher/tomato-production -> config for grapher with { slug: "tomato-production" } -> indicator metadata
 * currently we only attach a small amount of metadata that we need for key-indicator blocks.
 * In the future we might want to attach more metadata, e.g. the indicator's description, source, etc
 */
export interface LinkedIndicator {
    id: number
    title: string
    attributionShort?: string
}

export enum OwidGdocType {
    Article = "article",
    TopicPage = "topic-page",
    Fragment = "fragment",
    LinearTopicPage = "linear-topic-page",
    DataInsight = "data-insight",
    Homepage = "homepage",
    AboutPage = "about-page",
    Author = "author",
    Announcement = "announcement",
}

export interface OwidGdocBaseInterface {
    id: string
    slug: string
    // TODO: should we type this as a union of the possible content types instead?
    content: OwidGdocContent
    published: boolean
    createdAt: Date
    publishedAt: Date | null
    updatedAt: Date | null
    revisionId: string | null
    publicationContext: OwidGdocPublicationContext
    manualBreadcrumbs: BreadcrumbItem[] | null
    linkedAuthors?: LinkedAuthor[]
    linkedDocuments?: Record<string, OwidGdocMinimalPostInterface>
    linkedCharts?: Record<string, LinkedChart>
    linkedNarrativeCharts?: Record<string, NarrativeChartInfo>
    linkedIndicators?: Record<number, LinkedIndicator>
    imageMetadata?: Record<string, ImageMetadata>
    relatedCharts?: RelatedChart[]
    tags?: MinimalTag[] | null
    errors?: OwidGdocErrorMessage[]
    breadcrumbs?: BreadcrumbItem[] | null
    markdown: string | null
}

export interface OwidGdocPostInterface extends OwidGdocBaseInterface {
    content: OwidGdocPostContent
}

// Used for linkedDocuments attachments, instead of attaching the entire gdoc model
export interface OwidGdocMinimalPostInterface {
    id: string
    title: string // used in prominent links, topic-page-intro related topics, etc
    slug: string
    authors: string[] // used in research & writing block
    publishedAt: string | null // used in research & writing block
    published: boolean // used in preview to validate whether or not the post will display
    subtitle: string // used in prominent links & research & writing block
    excerpt: string // used in prominent links
    type: OwidGdocType // used in useLinkedDocument to prepend /data-insights/ to the slug
    "featured-image"?: string // used in prominent links and research & writing block
    kicker?: string // used in homepage announcements
    cta?: { text: string; url: string } // used in homepage announcements
}

export type OwidGdocIndexItem = Pick<
    OwidGdocBaseInterface,
    "id" | "slug" | "tags" | "published" | "publishedAt"
> &
    Pick<OwidGdocContent, "title" | "authors" | "type">

export function extractGdocIndexItem(
    gdoc: OwidGdocBaseInterface
): OwidGdocIndexItem {
    return {
        id: gdoc.id,
        slug: gdoc.slug,
        tags: gdoc.tags ?? [],
        published: gdoc.published,
        publishedAt: gdoc.publishedAt,
        title: gdoc.content.title ?? "",
        authors: gdoc.content.authors,
        type: gdoc.content.type,
    }
}

export interface OwidGdocDataInsightContent {
    title: string
    authors: string[]
    ["narrative-chart"]?: string
    ["grapher-url"]?: string
    ["figma-url"]?: string
    ["approved-by"]: string // can't publish an insight unless this is set
    body: OwidEnrichedGdocBlock[]
    type: OwidGdocType.DataInsight
}

export type OwidGdocDataInsightIndexItem = Pick<
    OwidGdocBaseInterface,
    "id" | "slug" | "tags" | "published" | "publishedAt" | "markdown"
> &
    Pick<OwidGdocDataInsightContent, "title" | "authors"> & {
        approvedBy?: OwidGdocDataInsightContent["approved-by"]
        grapherUrl?: OwidGdocDataInsightContent["grapher-url"]
        explorerUrl?: OwidGdocDataInsightContent["grapher-url"]
        narrativeChart?: Pick<
            DbPlainNarrativeChart,
            "id" | "name" | "chartConfigId"
        >
        chartType?: GrapherChartOrMapType
        figmaUrl?: OwidGdocDataInsightContent["figma-url"]
        image?: {
            id: NonNullable<DbRawImage["id"]>
            filename: NonNullable<DbRawImage["filename"]>
            cloudflareId: NonNullable<DbRawImage["cloudflareId"]>
            originalWidth: NonNullable<DbRawImage["originalWidth"]>
        }
    }

export const DATA_INSIGHTS_INDEX_PAGE_SIZE = 20
export const LATEST_INDEX_PAGE_SIZE = 20

export interface OwidGdocDataInsightInterface extends OwidGdocBaseInterface {
    content: OwidGdocDataInsightContent
    latestDataInsights?: LatestDataInsight[]
}

export type MinimalDataInsightInterface = Pick<
    OwidGdocDataInsightContent,
    "title"
> & {
    publishedAt: string
    updatedAt: string
    slug: string
    // Not used in any UI, only needed for the data insights atom feed
    authors: string[]
    // We select the 5 most recently published insights
    // We only display 4, but if you're on the DI page for one of them we hide it and show the next most recent
    index: 0 | 1 | 2 | 3 | 4
}

export interface OwidGdocAnnouncementContent {
    title: string
    excerpt: string
    authors: string[]
    "featured-image"?: string
    kicker?: string
    body: OwidEnrichedGdocBlock[]
    type: OwidGdocType.Announcement
    cta?: {
        text: string
        url: string
    }
}

export interface OwidGdocAnnouncementInterface extends OwidGdocBaseInterface {
    content: OwidGdocAnnouncementContent
}

export interface OwidGdocHomepageContent {
    type: OwidGdocType.Homepage
    title?: string
    authors: string[]
    body: OwidEnrichedGdocBlock[]
}

export interface OwidGdocHomepageMetadata {
    chartCount?: number
    topicCount?: number
    explorerCount?: number
    tagGraph?: TagGraphRoot
    announcements?: OwidGdocMinimalPostInterface[]
}

export interface OwidGdocHomepageInterface extends OwidGdocBaseInterface {
    content: OwidGdocHomepageContent
    linkedDocuments?: Record<string, OwidGdocMinimalPostInterface>
    homepageMetadata?: OwidGdocHomepageMetadata
    latestDataInsights?: LatestDataInsight[]
}

export interface OwidGdocAuthorContent {
    type: OwidGdocType.Author
    title?: string
    role: string
    bio?: EnrichedBlockText[]
    socials?: EnrichedBlockSocials
    "featured-image"?: string
    authors: string[]
    body: OwidEnrichedGdocBlock[]
}

export interface OwidGdocAuthorInterface extends OwidGdocBaseInterface {
    content: OwidGdocAuthorContent
    latestWorkLinks?: DbEnrichedLatestWork[]
}

export interface OwidGdocAboutContent {
    type: OwidGdocType.AboutPage
    title: string
    excerpt?: string
    "featured-image"?: string
    authors: string[]
    "hide-nav"?: boolean
    // By default, all about pages render with the title "About" even if they have a title set
    // (which we use in the gdocs index page in the admin)
    // This boolean makes it so that the title is used in *both* locations
    "override-title"?: boolean
    body: OwidEnrichedGdocBlock[]
    refs?: { definitions: RefDictionary; errors: OwidGdocErrorMessage[] }
}

export interface OwidGdocAboutInterface extends OwidGdocBaseInterface {
    content: OwidGdocAboutContent
    donors?: string[]
}

export type OwidGdocContent =
    | OwidGdocPostContent
    | OwidGdocDataInsightContent
    | OwidGdocHomepageContent
    | OwidGdocAuthorContent
    | OwidGdocAboutContent
    | OwidGdocAnnouncementContent

export type OwidGdoc =
    | OwidGdocPostInterface
    | OwidGdocDataInsightInterface
    | OwidGdocHomepageInterface
    | OwidGdocAuthorInterface
    | OwidGdocAboutInterface
    | OwidGdocAnnouncementInterface

export enum OwidGdocErrorMessageType {
    Error = "error",
    Warning = "warning",
}

export type OwidGdocProperty =
    | keyof OwidGdocPostInterface
    | keyof OwidGdocPostContent
    | keyof OwidGdocDataInsightInterface
    | keyof OwidGdocDataInsightContent
    | keyof OwidGdocAnnouncementInterface
    | keyof OwidGdocAnnouncementContent
    | keyof OwidGdocAuthorInterface
    | keyof OwidGdocAuthorContent
    | keyof OwidGdocAboutInterface
    | keyof OwidGdocAboutContent

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

export interface OwidGdocPostContent {
    body?: OwidEnrichedGdocBlock[]
    type?:
        | OwidGdocType.Article
        | OwidGdocType.TopicPage
        | OwidGdocType.LinearTopicPage
        // TODO: Fragments need their own OwidGdocFragment interface and flow in the UI
        // Historically they were treated the same as GdocPosts but not baked
        // In reality, they have multiple possible data structures in their content (details, faqs, etc)
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
    "deprecation-notice"?: EnrichedBlockText[]
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

export type EnrichedDetail = {
    id: string
    text: string
}

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

export type LatestPageItem =
    | { type: OwidGdocType.Article; data: OwidGdocMinimalPostInterface }
    | { type: OwidGdocType.DataInsight; data: LatestDataInsight }
    | { type: OwidGdocType.Announcement; data: OwidGdocAnnouncementInterface }
