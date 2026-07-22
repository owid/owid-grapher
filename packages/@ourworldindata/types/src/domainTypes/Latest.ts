import {
    LinkedAuthor,
    LinkedChart,
    OwidGdocMinimalPostInterface,
    OwidGdocType,
} from "../gdocTypes/Gdoc.js"
import { OwidEnrichedGdocBlock } from "../gdocTypes/ArchieMlComponents.js"
import { ImageMetadata } from "../gdocTypes/Image.js"
import * as z from "zod/mini"

/* Latest filter state */

/**
 * The flat content-category dimension of gdoc-backed content. For articles
 * and data insights this mirrors the gdoc type; for announcements it reflects
 * the (slugified) kicker. Absent for gdoc types that are indexed but not
 * shown on /latest (topic pages, linear topic pages).
 *
 * Deliberately excludes "newsletter": the dynamic /atom.xml?type= Cloudflare
 * Function validates its `type` param against this constant, and newsletters
 * must never appear in our feeds — Mailchimp consumes those feeds to send
 * newsletters in the first place. Use LATEST_PAGE_TYPE_VALUES for the
 * /latest page UI instead.
 */
export const LATEST_TYPE_VALUES = [
    "data-insight",
    "article",
    "data-update",
    "topic-update",
    "website-upgrade",
    "announcement",
] as const

/**
 * All type values filterable on the /latest page: the gdoc-backed
 * LATEST_TYPE_VALUES plus newsletters (synced from the Mailchimp campaign
 * archive — see the `newsletters` DB table).
 *
 * Ordered as displayed in the /latest "Filter by type" dropdown so callers
 * can iterate this tuple directly to render the dropdown.
 */
export const LATEST_PAGE_TYPE_VALUES = [
    ...LATEST_TYPE_VALUES,
    "newsletter",
] as const
export type LatestType = (typeof LATEST_PAGE_TYPE_VALUES)[number]

/**
 * A newsletter shown as a tile on /latest, linking out to its Mailchimp
 * campaign-archive page. Newsletters deliberately live outside the
 * pages-chronological Algolia index (and therefore outside /search and the
 * atom feeds, which Mailchimp itself consumes): the baker injects them into
 * latest.html as `window._OWID_NEWSLETTERS` and the /latest SPA weaves them
 * into the feed client-side. Synced from the Mailchimp Marketing API into the
 * `newsletters` DB table by baker/syncNewslettersFromMailchimp.ts.
 */
export interface LatestNewsletter {
    mailchimpId: string
    title: string
    /** External Mailchimp campaign-archive URL the tile links out to */
    url: string
    /** ISO timestamp of when the campaign was sent */
    date: string
}

export const NEWSLETTERS_WINDOW_PROP = "_OWID_NEWSLETTERS"

/**
 * Archive URL of the most recent Data Insights edition, shown as the
 * "see example" link on /subscribe. Baked into the page (and read back on
 * hydration via window._OWID_NEWSLETTER_EXAMPLES so server and client render
 * identically). Optional so the page still renders from an empty newsletters
 * table; the form falls back to a static example link. The OWID Brief link
 * needs no baked data — it points to /latest?type=newsletter.
 */
export interface NewsletterExampleUrls {
    dataInsightsUrl?: string
}

// Subset of LATEST_TYPE_VALUES that announcement gdocs can map to via their
// (slugified) kicker. Validated upstream in GdocAnnouncement._validateSubclass
// so unrecognized kickers can't reach a published announcement.
export const ANNOUNCEMENT_LATEST_TYPES = [
    "data-update",
    "topic-update",
    "website-upgrade",
    "announcement",
] as const satisfies readonly LatestType[]
export type AnnouncementLatestType = (typeof ANNOUNCEMENT_LATEST_TYPES)[number]

/** Singular display labels for a LatestType. Iterate LATEST_PAGE_TYPE_VALUES
 * to get the dropdown display order; append "s" for the plural form used as
 * the dropdown label. Used wherever a per-item kicker is rendered
 * (announcement page, homepage announcement card, /latest hit metadata). */
export const LATEST_TYPE_LABELS: Record<LatestType, string> = {
    "data-insight": "Data Insight",
    article: "Article",
    "data-update": "Data update",
    "topic-update": "Topic update",
    "website-upgrade": "Website upgrade",
    announcement: "Announcement",
    newsletter: "Newsletter",
}

export const LATEST_PATH = "/latest"

export enum LatestUrlParam {
    TOPICS = "topics",
    TYPE = "type",
}

export interface LatestState {
    topics: string[]
    latestType: LatestType | null
}

export const DEFAULT_LATEST_STATE: LatestState = {
    topics: [],
    latestType: null,
}

/* Shared schema helpers */

// OwidEnrichedGdocBlock and the linked attachment types don't have zod schemas
// yet, but consumers should keep their existing TypeScript types for those
// fields.
const castSchemaOutput = <T>(schema: z.ZodMiniType) =>
    z.pipe(
        schema,
        z.transform((value) => value as T)
    )

const OwidEnrichedGdocBlocksSchema = castSchemaOutput<OwidEnrichedGdocBlock[]>(
    z.array(z.any())
)

const LinkedAttachmentsShape = {
    linkedCharts: z.optional(
        castSchemaOutput<Record<string, LinkedChart>>(
            z.record(z.string(), z.any())
        )
    ),
    linkedDocuments: z.optional(
        castSchemaOutput<Record<string, OwidGdocMinimalPostInterface>>(
            z.record(z.string(), z.any())
        )
    ),
}

// Only the renderable variants (DataInsight, Article, Announcement) carry
// imageMetadata — topic pages can't, by type-level construction. Mirrors how
// LinkedAttachmentsShape is spread only into the variants that need it.
const ImageAttachmentShape = {
    imageMetadata: z.optional(
        castSchemaOutput<Record<string, ImageMetadata>>(
            z.record(z.string(), z.any())
        )
    ),
}

/* Chronological record base */

const ChronologicalRecordBaseShape = {
    objectID: z.string(),
    slug: z.string(),
    title: z.string(),
    excerpt: z.string(),
    date: z.string(),
    modifiedDate: z.string(),
    authors: z.array(z.string()),
    tags: z.array(z.string()),
    thumbnailUrl: z.string(),
}

const PageChronologicalRecordBaseSchema = z.strictObject(
    ChronologicalRecordBaseShape
)
export type PageChronologicalRecordBase = z.infer<
    typeof PageChronologicalRecordBaseSchema
>

/* Chronological record variants */

// Data insight

const PageChronologicalDataInsightRecordPayloadSchema = z.strictObject({
    ...ImageAttachmentShape,
    type: z.literal(OwidGdocType.DataInsight),
    latestType: z.literal("data-insight"),
    body: OwidEnrichedGdocBlocksSchema,
})
export type PageChronologicalDataInsightRecordPayload = z.infer<
    typeof PageChronologicalDataInsightRecordPayloadSchema
>
const PageChronologicalDataInsightRecordSchema = z.strictObject({
    ...ChronologicalRecordBaseShape,
    ...PageChronologicalDataInsightRecordPayloadSchema.shape,
})
export type PageChronologicalDataInsightRecord = z.infer<
    typeof PageChronologicalDataInsightRecordSchema
>

// Article

const PageChronologicalArticleRecordPayloadSchema = z.strictObject({
    ...LinkedAttachmentsShape,
    ...ImageAttachmentShape,
    type: z.literal(OwidGdocType.Article),
    latestType: z.literal("article"),
    featuredImage: z.optional(z.string()),
    latestFeedFeaturedImage: z.optional(z.string()),
    latestFeedExcerpt: z.optional(OwidEnrichedGdocBlocksSchema),
})
export type PageChronologicalArticleRecordPayload = z.infer<
    typeof PageChronologicalArticleRecordPayloadSchema
>
const PageChronologicalArticleRecordSchema = z.strictObject({
    ...ChronologicalRecordBaseShape,
    ...PageChronologicalArticleRecordPayloadSchema.shape,
})
export type PageChronologicalArticleRecord = z.infer<
    typeof PageChronologicalArticleRecordSchema
>

// Announcement

const PageChronologicalAnnouncementRecordPayloadSchema = z.strictObject({
    ...LinkedAttachmentsShape,
    ...ImageAttachmentShape,
    type: z.literal(OwidGdocType.Announcement),
    latestType: z.enum(ANNOUNCEMENT_LATEST_TYPES),
    body: OwidEnrichedGdocBlocksSchema,
    cta: z.optional(
        z.strictObject({
            text: z.string(),
            url: z.string(),
        })
    ),
    linkedAuthors: z.optional(
        castSchemaOutput<LinkedAuthor[]>(z.array(z.any()))
    ),
})
export type PageChronologicalAnnouncementRecordPayload = z.infer<
    typeof PageChronologicalAnnouncementRecordPayloadSchema
>
const PageChronologicalAnnouncementRecordSchema = z.strictObject({
    ...ChronologicalRecordBaseShape,
    ...PageChronologicalAnnouncementRecordPayloadSchema.shape,
})
export type PageChronologicalAnnouncementRecord = z.infer<
    typeof PageChronologicalAnnouncementRecordSchema
>

// Topic page

const PageChronologicalTopicPageRecordPayloadSchema = z.strictObject({
    type: z.literal(OwidGdocType.TopicPage),
})
export type PageChronologicalTopicPageRecordPayload = z.infer<
    typeof PageChronologicalTopicPageRecordPayloadSchema
>
const PageChronologicalTopicPageRecordSchema = z.strictObject({
    ...ChronologicalRecordBaseShape,
    ...PageChronologicalTopicPageRecordPayloadSchema.shape,
})
export type PageChronologicalTopicPageRecord = z.infer<
    typeof PageChronologicalTopicPageRecordSchema
>

// Linear topic page

const PageChronologicalLinearTopicPageRecordPayloadSchema = z.strictObject({
    type: z.literal(OwidGdocType.LinearTopicPage),
})
export type PageChronologicalLinearTopicPageRecordPayload = z.infer<
    typeof PageChronologicalLinearTopicPageRecordPayloadSchema
>
const PageChronologicalLinearTopicPageRecordSchema = z.strictObject({
    ...ChronologicalRecordBaseShape,
    ...PageChronologicalLinearTopicPageRecordPayloadSchema.shape,
})
export type PageChronologicalLinearTopicPageRecord = z.infer<
    typeof PageChronologicalLinearTopicPageRecordSchema
>

/* Chronological record unions */

// Lightweight record for the chronological pages index (one per page, no
// chunked content). Strict objects reject unknown keys, so fields from another
// variant fail validation instead of being silently stripped before indexing.
export const PageChronologicalRecordSchema = z.discriminatedUnion("type", [
    PageChronologicalDataInsightRecordSchema,
    PageChronologicalArticleRecordSchema,
    PageChronologicalAnnouncementRecordSchema,
    PageChronologicalTopicPageRecordSchema,
    PageChronologicalLinearTopicPageRecordSchema,
])

export type PageChronologicalRecord = z.infer<
    typeof PageChronologicalRecordSchema
>

export type LatestPageChronologicalRecord =
    | PageChronologicalArticleRecord
    | PageChronologicalDataInsightRecord
    | PageChronologicalAnnouncementRecord

export type PageChronologicalRecordVariantPayload =
    | PageChronologicalDataInsightRecordPayload
    | PageChronologicalArticleRecordPayload
    | PageChronologicalAnnouncementRecordPayload
    | PageChronologicalTopicPageRecordPayload
    | PageChronologicalLinearTopicPageRecordPayload

export type PageChronologicalLinkedAttachments = Pick<
    PageChronologicalArticleRecord,
    "linkedCharts" | "linkedDocuments"
>
