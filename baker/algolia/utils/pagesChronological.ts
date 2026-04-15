import * as _ from "lodash-es"
import * as db from "../../../db/db.js"
import {
    OwidGdocType,
    checkIsChronologicalFeedPost,
    getUniqueNamesFromTagHierarchies,
    slugify,
} from "@ourworldindata/utils"
import {
    OwidGdocAnnouncementInterface,
    OwidGdocDataInsightInterface,
    OwidGdocPostInterface,
    PageChronologicalRecord,
    SearchIndexName,
    DbEnrichedImage,
} from "@ourworldindata/types"
import { gdocFromJSON } from "../../../db/model/Gdoc/GdocFactory.js"
import { getAlgoliaClient } from "../configureAlgolia.js"
import { getIndexName } from "../../../site/search/searchClient.js"
import { ALGOLIA_INDEXING } from "../../../settings/serverSettings.js"
import { getThumbnailUrl, getExcerptFromGdoc } from "./pages.js"

/**
 * The subset of OwidGdoc that ends up indexed on /latest — what
 * `checkIsChronologicalFeedPost` narrows to.
 */
type ChronologicalGdoc =
    | OwidGdocPostInterface
    | OwidGdocDataInsightInterface
    | OwidGdocAnnouncementInterface

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
 */
function buildAttachment(
    gdoc: ChronologicalGdoc
): Partial<PageChronologicalRecord> {
    const attachment: Partial<PageChronologicalRecord> = {}

    if (!_.isEmpty(gdoc.imageMetadata)) {
        attachment.imageMetadata = gdoc.imageMetadata
    }

    // Dispatch on `content.type` (discriminated union) rather than
    // `instanceof`, so this works both for class instances (bulk path) and
    // plain DTOs from `toJSON()` (individual path from apiRoutes/gdocs.ts).
    if (gdoc.content.type === OwidGdocType.DataInsight) {
        // Include the full body for inline rendering of data insights
        if (gdoc.content.body) {
            attachment.body = gdoc.content.body
        }
    } else if (gdoc.content.type === OwidGdocType.Article) {
        if (gdoc.content["featured-image"]) {
            attachment.featuredImage = gdoc.content["featured-image"]
        }
        if (gdoc.content["latest-featured-image"]) {
            attachment.latestFeaturedImage =
                gdoc.content["latest-featured-image"]
        }
        if (gdoc.content["latest-excerpt"]?.length) {
            attachment.latestExcerpt = gdoc.content["latest-excerpt"]
            // Carry linked charts/documents so internal links in the
            // rich excerpt can resolve via AttachmentsContext.
            copyLinkedContentIfPresent(attachment, gdoc)
        }
    } else if (gdoc.content.type === OwidGdocType.Announcement) {
        if (gdoc.content.kicker) {
            // Slugify the kicker to normalize casing discrepancies in
            // gdocs (e.g. "Data Update" vs "Data update") so that the
            // filter values in latestFilters.ts can match.
            enrichment.kicker = slugify(gdoc.content.kicker)
        }
        attachment.announcementContent = {
            body: gdoc.content.body,
            cta: gdoc.content.cta,
        }
        if (gdoc.linkedAuthors?.length) {
            attachment.linkedAuthors = gdoc.linkedAuthors
        }
        // For non-CTA announcements, include linked charts and documents
        if (!gdoc.content.cta) {
            copyLinkedContentIfPresent(attachment, gdoc)
        }
    }

    return attachment
}

function buildChronologicalRecord(
    gdoc: ChronologicalGdoc,
    topicTags: string[],
    cloudflareImagesByFilename: Record<string, DbEnrichedImage>
): PageChronologicalRecord {
    const base: PageChronologicalRecord = {
        objectID: gdoc.id,
        type: gdoc.content.type!,
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
    const record = buildChronologicalRecord(
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
        if (gdoc.content.type === OwidGdocType.Announcement) {
            await gdoc.loadLinkedAuthors(knex)
            await gdoc.loadLinkedCharts(knex)
            await gdoc.loadLinkedDocuments(knex)
        }
        // Articles with a rich latest-excerpt may contain internal links that
        // LinkedA resolves via AttachmentsContext.
        if (
            gdoc.content.type === OwidGdocType.Article &&
            gdoc.content["latest-excerpt"]?.length
        ) {
            await gdoc.loadLinkedCharts(knex)
            await gdoc.loadLinkedDocuments(knex)
        }
        gdoc.imageMetadata = _.pick(
            cloudflareImagesByFilename,
            gdoc.linkedImageFilenames
        )

        // The DB query already filtered to chronological-eligible types, so
        // this guard is effectively a TypeScript narrowing hatch to convert
        // `gdocFromJSON`'s broad union into `ChronologicalGdoc`.
        if (!checkIsChronologicalFeedPost(gdoc)) continue

        const originalTagNames = gdoc.tags?.map((t) => t.name) ?? []
        const topicTags = getUniqueNamesFromTagHierarchies(
            originalTagNames,
            topicHierarchiesByChildName
        )

        records.push(
            buildChronologicalRecord(
                gdoc,
                topicTags,
                cloudflareImagesByFilename
            )
        )
    }

    return records
}
