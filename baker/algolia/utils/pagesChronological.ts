import * as _ from "lodash-es"
import * as db from "../../../db/db.js"
import {
    OwidGdocType,
    checkIsChronologicalGdoc,
    checkIsLatestFeedGdoc,
    getUniqueNamesFromTagHierarchies,
} from "@ourworldindata/utils"
import {
    ChronologicalGdoc,
    PageChronologicalRecord,
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
import { deriveLatestType } from "../../../site/latest/latestUtils.js"
import { ALGOLIA_INDEXING } from "../../../settings/serverSettings.js"
import { getThumbnailUrl, getExcerptFromGdoc } from "./pages.js"
import { match, P } from "ts-pattern"

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
 * Load the linked-content fields each chronological gdoc type needs
 * for indexing. Mirrors the per-type contract enforced by `buildAttachment`
 * — keep these two functions in sync when adding a new type.
 *
 * Takes `ChronologicalGdoc & GdocBase` because we need both the discriminated
 * `content` shape (from the interface union) and the `loadLinkedX(knex)`
 * methods (declared on the GdocBase class). Class instances from
 * `gdocFromJSON` satisfy both.
 */
async function loadAttachmentsForChronologicalIndexing(
    gdoc: ChronologicalGdoc & GdocBase,
    knex: db.KnexReadonlyTransaction
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
        // branch in `buildAttachment` for the rationale (DI bodies are
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
}

/** Copy linkedCharts / linkedDocuments into the attachment if non-empty. */
function copyLinkedContentIfPresent(
    attachment: Partial<PageChronologicalRecord>,
    gdoc: ChronologicalGdoc
): void {
    if (gdoc.linkedCharts && Object.keys(gdoc.linkedCharts).length > 0) {
        attachment.linkedCharts = gdoc.linkedCharts
    }
    if (gdoc.linkedDocuments && Object.keys(gdoc.linkedDocuments).length > 0) {
        attachment.linkedDocuments = gdoc.linkedDocuments
    }
}

/**
 * Build type-specific attachment fields for a PageChronologicalRecord.
 * Dispatches on `content.type` so it works both for class instances
 * (bulk path) and plain objects from `toJSON()` (individual path).
 */
function buildAttachment(
    gdoc: ChronologicalGdoc
): Partial<PageChronologicalRecord> {
    const attachment: Partial<PageChronologicalRecord> = {}

    if (!_.isEmpty(gdoc.imageMetadata)) {
        attachment.imageMetadata = gdoc.imageMetadata
    }

    match(gdoc)
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
            if (g.content.body) {
                attachment.body = g.content.body
            }
        })
        .with({ content: { type: OwidGdocType.Article } }, (g) => {
            if (g.content["featured-image"]) {
                attachment.featuredImage = g.content["featured-image"]
            }
            if (g.content["latest-feed-featured-image"]) {
                attachment.latestFeedFeaturedImage =
                    g.content["latest-feed-featured-image"]
            }
            if (g.content["latest-feed-excerpt"]?.length) {
                attachment.latestFeedExcerpt = g.content["latest-feed-excerpt"]
                // Carry linked charts/documents so internal links in the
                // rich excerpt can resolve via AttachmentsContext.
                copyLinkedContentIfPresent(attachment, g)
            }
        })
        .with({ content: { type: OwidGdocType.Announcement } }, (g) => {
            attachment.body = g.content.body
            if (g.content.cta) {
                attachment.cta = g.content.cta
            }
            if (g.linkedAuthors?.length) {
                attachment.linkedAuthors = g.linkedAuthors
            }
            // For non-CTA announcements, include linked charts and documents
            if (!g.content.cta) {
                copyLinkedContentIfPresent(attachment, g)
            }
        })
        // Topic pages are indexed for the atom feed but don't need any
        // type-specific attachment fields — only the base record's
        // title/excerpt/date matters. (They're filtered out of /latest
        // entirely by LATEST_BASE_FILTER, so no card body ever renders.)
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

    return attachment
}

async function buildChronologicalRecord(
    gdoc: ChronologicalGdoc,
    topicTags: string[],
    cloudflareImagesByFilename: Record<string, DbEnrichedImage>
): Promise<PageChronologicalRecord> {
    const base: PageChronologicalRecord = {
        objectID: gdoc.id,
        type: gdoc.content.type,
        latestType: checkIsLatestFeedGdoc(gdoc)
            ? deriveLatestType(gdoc)
            : undefined,
        slug: gdoc.slug,
        title: gdoc.content.title || "",
        excerpt: getExcerptFromGdoc(gdoc),
        date: gdoc.publishedAt!.toISOString(),
        modifiedDate: (gdoc.updatedAt ?? gdoc.publishedAt!).toISOString(),
        authors: gdoc.content.authors ?? [],
        tags: [...topicTags],
        thumbnailUrl: getThumbnailUrl(gdoc, cloudflareImagesByFilename),
    }
    return { ...base, ...buildAttachment(gdoc) }
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

    const cloudflareImagesByFilename = await db
        .getCloudflareImages(knex)
        .then((images) => _.keyBy(images, "filename"))

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

    const cloudflareImagesByFilename = await db
        .getCloudflareImages(knex)
        .then((images) => _.keyBy(images, "filename"))

    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(knex)

    // Populate state on each cold gdoc (from gdocFromJSON) to match what
    // loadState() would have done, then build its record. Ordering matters:
    // linked{Authors,Documents} must be loaded before imageMetadata so
    // linkedImageFilenames can pull in author avatars and prominent-link
    // thumbnails.
    const records: PageChronologicalRecord[] = []
    for (const gdoc of gdocs) {
        // Narrow gdocFromJSON's broad return to a chronological class
        // instance with a content.type literal-narrowed to ChronologicalGdoc's
        // 5-type set. The DB query above already constrains rows to those
        // types, so this is primarily a static-typing hatch — and a
        // defensive guard against future additions to the query.
        if (!isChronologicalGdocInstance(gdoc)) continue

        await loadAttachmentsForChronologicalIndexing(gdoc, knex)
        gdoc.imageMetadata = _.pick(
            cloudflareImagesByFilename,
            gdoc.linkedImageFilenames
        )

        const originalTagNames = gdoc.tags?.map((t) => t.name) ?? []
        const topicTags = getUniqueNamesFromTagHierarchies(
            originalTagNames,
            topicHierarchiesByChildName
        )

        records.push(
            await buildChronologicalRecord(
                gdoc,
                topicTags,
                cloudflareImagesByFilename
            )
        )
    }

    return records
}
