import * as _ from "lodash-es"
import * as db from "../../../db/db.js"
import {
    OwidGdocType,
    checkIsChronologicalGdoc,
    getUniqueNamesFromTagHierarchies,
} from "@ourworldindata/utils"
import {
    ChronologicalGdoc,
    PageChronologicalRecord,
    PageChronologicalRecordBase,
    PageChronologicalRecordVariantPayload,
    PageChronologicalRecordSchema,
    PageChronologicalArticleRecordPayload,
    PageChronologicalAnnouncementRecordPayload,
    PageChronologicalLinkedAttachments,
    SearchIndexName,
    DbEnrichedImage,
} from "@ourworldindata/types"
import { gdocFromJSON } from "../../../db/model/Gdoc/GdocFactory.js"
import { GdocBase } from "../../../db/model/Gdoc/GdocBase.js"
import { GdocPost } from "../../../db/model/Gdoc/GdocPost.js"
import { GdocDataInsight } from "../../../db/model/Gdoc/GdocDataInsight.js"
import { GdocAnnouncement } from "../../../db/model/Gdoc/GdocAnnouncement.js"
import { getAlgoliaClient } from "../configureAlgolia.js"
import { getIndexName } from "../../../site/search/searchClient.js"
import { deriveAnnouncementLatestType } from "../../../site/latest/latestUtils.js"
import { ALGOLIA_INDEXING } from "../../../settings/serverSettings.js"
import { getThumbnailUrl, getExcerptFromGdoc } from "./pages.js"
import { match, P } from "ts-pattern"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"

/**
 * Like `checkIsChronologicalGdoc`, but narrows to the Gdoc *class* so
 * callers can use `loadLinkedX(knex)` (defined on `GdocBase`).
 */
function isChronologicalGdocInstance(
    gdoc: ReturnType<typeof gdocFromJSON>
): gdoc is (GdocPost | GdocDataInsight | GdocAnnouncement) & ChronologicalGdoc {
    return checkIsChronologicalGdoc(gdoc)
}

/**
 * Load the attachments each chronological gdoc type needs for indexing. Mirrors
 * the per-type contract enforced by `buildVariantPayload` — keep these two
 * functions in sync when adding a new type.
 *
 * Takes `ChronologicalGdoc & GdocBase` because we need both the discriminated
 * `content` shape (from the interface union) and the `loadLinkedX(knex)`
 * methods (declared on the GdocBase class). Class instances from `gdocFromJSON`
 * satisfy both.
 *
 * Ordering matters: linked{Authors,Documents} must be loaded before
 * imageMetadata, because `linkedImageFilenames` derives filenames from each
 * linkedAuthors's `featuredImage` (author avatars) and each linkedDocument's
 * `featured-image` (prominent-link thumbnails)
 */
async function loadAttachmentsForChronologicalIndexing(
    gdoc: ChronologicalGdoc & GdocBase,
    knex: db.KnexReadonlyTransaction,
    cloudflareImagesByFilename: Record<string, DbEnrichedImage>
): Promise<void> {
    await match(gdoc)
        .with({ content: { type: OwidGdocType.Announcement } }, async (g) => {
            await g.loadLinkedAuthors(knex)
            await g.loadLinkedCharts(knex)
            await g.loadLinkedDocuments(knex)
        })
        .with({ content: { type: OwidGdocType.Article } }, async (g) => {
            // Articles with a rich latest-feed-excerpt may contain internal
            // links that LinkedA resolves via AttachmentsContext.
            if (g.content["latest-feed-excerpt"]?.length) {
                await g.loadLinkedCharts(knex)
                await g.loadLinkedDocuments(knex)
            }
        })
        // DataInsight: intentionally no extra loads — see the DataInsight
        // branch in `buildVariantPayload` for the rationale (DI bodies are
        // image + text by convention, matching the homepage's
        // `getLatestDataInsights`).
        .with({ content: { type: OwidGdocType.DataInsight } }, _.noop)
        // Topic pages are indexed for the atom feed but don't need linked
        // content loaded — they only carry their title/excerpt/date in the
        // record. (They're filtered out of /latest entirely by
        // LATEST_BASE_FILTER, so their /latest-card body is never rendered.)
        .with(
            {
                content: {
                    type: P.union(
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage
                    ),
                },
            },
            _.noop
        )
        .exhaustive()

    gdoc.imageMetadata = _.pick(
        cloudflareImagesByFilename,
        gdoc.linkedImageFilenames
    )
}

/** Copy linkedCharts / linkedDocuments into the attachments if non-empty. */
function copyAttachmentsIfPresent(
    attachments: PageChronologicalLinkedAttachments,
    gdoc: ChronologicalGdoc
): void {
    if (gdoc.linkedCharts && Object.keys(gdoc.linkedCharts).length > 0) {
        attachments.linkedCharts = gdoc.linkedCharts
    }
    if (gdoc.linkedDocuments && Object.keys(gdoc.linkedDocuments).length > 0) {
        attachments.linkedDocuments = gdoc.linkedDocuments
    }
}

/**
 * Build type-specific fields for a PageChronologicalRecord.
 * Dispatches on `content.type` so it works both for class instances
 * (bulk path) and plain objects from `toJSON()` (individual path).
 */
function buildVariantPayload(
    gdoc: ChronologicalGdoc
): PageChronologicalRecordVariantPayload {
    return (
        match<ChronologicalGdoc, PageChronologicalRecordVariantPayload>(gdoc)
            .with({ content: { type: OwidGdocType.DataInsight } }, (g) => {
                // Ship the full body for inline rendering on /latest cards. We
                // deliberately don't ship linkedCharts / linkedDocuments here (and
                // don't load them in `getPagesChronologicalRecords` either),
                // mirroring the homepage's `getLatestDataInsights` (db/model/Gdoc/
                // GdocFactory.ts) which only loads imageMetadata. The editorial
                // convention is that DI bodies are image + text; chart /
                // prominent-link / cta blocks would degrade on cards on both
                // surfaces, but in practice DIs don't author them. Revisit if that
                // convention starts breaking.
                return {
                    type: OwidGdocType.DataInsight,
                    latestType: "data-insight",
                    body: g.content.body,
                }
            })
            .with({ content: { type: OwidGdocType.Article } }, (g) => {
                const payload: PageChronologicalArticleRecordPayload = {
                    type: OwidGdocType.Article,
                    latestType: "article",
                }

                if (g.content["featured-image"]) {
                    payload.featuredImage = g.content["featured-image"]
                }
                if (g.content["latest-feed-featured-image"]) {
                    payload.latestFeedFeaturedImage =
                        g.content["latest-feed-featured-image"]
                }
                if (g.content["latest-feed-excerpt"]?.length) {
                    payload.latestFeedExcerpt = g.content["latest-feed-excerpt"]
                    // Carry linked charts/documents so internal links in the
                    // rich excerpt can resolve via AttachmentsContext.
                    copyAttachmentsIfPresent(payload, g)
                }

                return payload
            })
            .with({ content: { type: OwidGdocType.Announcement } }, (g) => {
                const payload: PageChronologicalAnnouncementRecordPayload = {
                    type: OwidGdocType.Announcement,
                    latestType: deriveAnnouncementLatestType(g.content.kicker),
                    body: g.content.body,
                }
                if (g.content.cta) {
                    payload.cta = g.content.cta
                } else {
                    // For non-CTA announcements, include linked charts and documents.
                    copyAttachmentsIfPresent(payload, g)
                }
                if (g.linkedAuthors?.length) {
                    payload.linkedAuthors = g.linkedAuthors
                }

                return payload
            })
            // Topic pages are indexed for the atom feed but don't need any
            // type-specific attachment fields — only the base record's
            // title/excerpt/date matters. (They're filtered out of /latest
            // entirely by LATEST_BASE_FILTER, so no card body ever renders.)
            .with({ content: { type: OwidGdocType.TopicPage } }, () => ({
                type: OwidGdocType.TopicPage,
            }))
            .with({ content: { type: OwidGdocType.LinearTopicPage } }, () => ({
                type: OwidGdocType.LinearTopicPage,
            }))
            .exhaustive()
    )
}

function formatZodIssues(
    issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>
): string {
    return issues
        .map((issue) => {
            const path = issue.path.length ? issue.path.join(".") : "<root>"
            return `${path}: ${issue.message}`
        })
        .join("; ")
}

async function validateChronologicalRecord(
    record: unknown,
    gdoc: ChronologicalGdoc
): Promise<PageChronologicalRecord | null> {
    const parsed = PageChronologicalRecordSchema.safeParse(record)

    if (parsed.success) return parsed.data

    void logErrorAndMaybeCaptureInSentry(
        new Error(
            `Invalid pages-chronological record for gdoc ${gdoc.id} (${gdoc.slug}): ${formatZodIssues(parsed.error.issues)}`
        )
    )
    return null
}

async function buildChronologicalRecord(
    gdoc: ChronologicalGdoc,
    topicTags: string[],
    cloudflareImagesByFilename: Record<string, DbEnrichedImage>
): Promise<PageChronologicalRecord | null> {
    const base: PageChronologicalRecordBase = {
        objectID: gdoc.id,
        slug: gdoc.slug,
        title: gdoc.content.title || "",
        excerpt: getExcerptFromGdoc(gdoc),
        date: gdoc.publishedAt!.toISOString(),
        modifiedDate: (gdoc.updatedAt ?? gdoc.publishedAt!).toISOString(),
        authors: gdoc.content.authors ?? [],
        tags: [...topicTags],
        thumbnailUrl: getThumbnailUrl(gdoc, cloudflareImagesByFilename),
    }
    if (!_.isEmpty(gdoc.imageMetadata)) {
        base.imageMetadata = gdoc.imageMetadata
    }

    return validateChronologicalRecord(
        { ...base, ...buildVariantPayload(gdoc) },
        gdoc
    )
}

export async function indexIndividualGdocInChronological(
    gdoc: ChronologicalGdoc,
    knex: db.KnexReadonlyTransaction
): Promise<void> {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(
            "Failed indexing to pages-chronological (Algolia client not initialized)"
        )
        return
    }

    const cloudflareImagesByFilename =
        await db.getCloudflareImagesByFilename(knex)

    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(knex)
    const originalTagNames = gdoc.tags?.map((t) => t.name) ?? []
    const topicTags = getUniqueNamesFromTagHierarchies(
        originalTagNames,
        topicHierarchiesByChildName
    )

    const indexName = getIndexName(SearchIndexName.PagesChronological)
    const record = await buildChronologicalRecord(
        gdoc,
        topicTags,
        cloudflareImagesByFilename
    )
    if (!record) return

    try {
        await client.saveObjects({
            indexName,
            objects: [record],
        })
    } catch (e) {
        console.error("Error indexing gdoc to pages-chronological:", e)
    }
}

export async function removeIndividualGdocFromChronological(
    gdocId: string
): Promise<void> {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client) {
        console.error(
            "Failed removing from pages-chronological (Algolia client not initialized)"
        )
        return
    }

    const indexName = getIndexName(SearchIndexName.PagesChronological)

    try {
        await client.deleteObjects({
            indexName,
            objectIDs: [gdocId],
        })
    } catch (e) {
        console.error("Error removing gdoc from pages-chronological:", e)
    }
}

export async function getPagesChronologicalRecords(
    knex: db.KnexReadonlyTransaction
): Promise<PageChronologicalRecord[]> {
    // Must stay in sync with `isChronologicalGdocInstance`: any type fetched
    // here that isn't chronological gets dropped by the predicate below, and
    // any chronological type missing here is silently skipped.
    const gdocs = await db
        .getPublishedGdocsWithTags(
            knex,
            [
                OwidGdocType.Announcement,
                OwidGdocType.Article,
                OwidGdocType.DataInsight,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
            ],
            { excludeDeprecated: true }
        )
        .then((gdocs) => gdocs.map(gdocFromJSON))

    const cloudflareImagesByFilename =
        await db.getCloudflareImagesByFilename(knex)

    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(knex)

    // Populate state on each cold gdoc (from gdocFromJSON) to match what
    // loadState() would have done, then build its record.
    const records: PageChronologicalRecord[] = []
    for (const gdoc of gdocs) {
        if (!isChronologicalGdocInstance(gdoc)) continue

        await loadAttachmentsForChronologicalIndexing(
            gdoc,
            knex,
            cloudflareImagesByFilename
        )

        const originalTagNames = gdoc.tags?.map((t) => t.name) ?? []
        const topicTags = getUniqueNamesFromTagHierarchies(
            originalTagNames,
            topicHierarchiesByChildName
        )

        const record = await buildChronologicalRecord(
            gdoc,
            topicTags,
            cloudflareImagesByFilename
        )
        if (record) records.push(record)
    }

    return records
}
