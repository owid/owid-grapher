import * as _ from "lodash-es"
import * as db from "../../../db/db.js"
import {
    OwidGdocType,
    OwidGdocPostInterface,
    OwidGdocDataInsightInterface,
    getUniqueNamesFromTagHierarchies,
    checkIsChronologicalFeedPost,
} from "@ourworldindata/utils"
import {
    OwidGdocAnnouncementInterface,
    PageChronologicalRecord,
    SearchIndexName,
    OwidGdoc,
    DbEnrichedImage,
} from "@ourworldindata/types"
import { gdocFromJSON } from "../../../db/model/Gdoc/GdocFactory.js"
import { getAlgoliaClient } from "../configureAlgolia.js"
import { getIndexName } from "../../../site/search/searchClient.js"
import { ALGOLIA_INDEXING } from "../../../settings/serverSettings.js"
import { getThumbnailUrl, getExcerptFromGdoc } from "./pages.js"
import { getFirstBlockOfType } from "../../../site/gdocs/utils.js"

type ChronologicalGdoc =
    | OwidGdocPostInterface
    | OwidGdocDataInsightInterface
    | OwidGdocAnnouncementInterface

/**
 * Collect image filenames referenced by a gdoc (featured image, body images, author images)
 * and return the subset of cloudflareImages that are relevant.
 */
function getRelevantImageMetadata(
    gdoc: ChronologicalGdoc,
    cloudflareImagesByFilename: Record<string, DbEnrichedImage>
): Record<string, DbEnrichedImage> | undefined {
    const filenames: string[] = []

    if (gdoc.content.type === OwidGdocType.DataInsight) {
        const firstImage = getFirstBlockOfType(
            gdoc as OwidGdocDataInsightInterface,
            "image"
        )
        if (firstImage?.filename) filenames.push(firstImage.filename)
        if (firstImage?.smallFilename) filenames.push(firstImage.smallFilename)
    }

    if ("featured-image" in gdoc.content && gdoc.content["featured-image"]) {
        filenames.push(gdoc.content["featured-image"])
    }

    // Announcement: collect images from body blocks and author featured images
    if (gdoc.content.type === OwidGdocType.Announcement) {
        const announcement = gdoc as OwidGdocAnnouncementInterface
        if (announcement.content.body) {
            for (const block of announcement.content.body) {
                if (block.type === "image") {
                    if (block.filename) filenames.push(block.filename)
                    if (block.smallFilename) filenames.push(block.smallFilename)
                }
            }
        }
        if (announcement.linkedAuthors) {
            for (const author of announcement.linkedAuthors) {
                if (author.featuredImage) filenames.push(author.featuredImage)
            }
        }
    }

    if (filenames.length === 0) return undefined

    const result: Record<string, DbEnrichedImage> = {}
    for (const fn of filenames) {
        if (cloudflareImagesByFilename[fn]) {
            result[fn] = cloudflareImagesByFilename[fn]
        }
    }
    return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Build type-specific enrichment fields for a PageChronologicalRecord.
 */
function buildEnrichment(
    gdoc: ChronologicalGdoc,
    cloudflareImagesByFilename: Record<string, DbEnrichedImage>
): Partial<PageChronologicalRecord> {
    const imageMetadata = getRelevantImageMetadata(
        gdoc,
        cloudflareImagesByFilename
    )
    const enrichment: Partial<PageChronologicalRecord> = {}

    if (imageMetadata) {
        enrichment.imageMetadata = imageMetadata
    }

    switch (gdoc.content.type) {
        case OwidGdocType.DataInsight: {
            const di = gdoc as OwidGdocDataInsightInterface
            // Include the full body for inline rendering of data insights
            if (di.content.body) {
                enrichment.body = di.content.body
            }
            break
        }
        case OwidGdocType.Article:
        case OwidGdocType.TopicPage:
        case OwidGdocType.LinearTopicPage: {
            const post = gdoc as OwidGdocPostInterface
            if (
                "featured-image" in post.content &&
                post.content["featured-image"]
            ) {
                enrichment.featuredImage = post.content["featured-image"]
            }
            break
        }
        case OwidGdocType.Announcement: {
            const announcement = gdoc as OwidGdocAnnouncementInterface
            if (announcement.content.kicker) {
                enrichment.kicker = announcement.content.kicker
            }
            enrichment.announcementContent = {
                body: announcement.content.body,
                kicker: announcement.content.kicker,
                cta: announcement.content.cta,
            }
            if (announcement.linkedAuthors?.length) {
                enrichment.linkedAuthors = announcement.linkedAuthors
            }
            // For non-CTA announcements, include linked charts and documents
            if (!announcement.content.cta) {
                if (
                    announcement.linkedCharts &&
                    Object.keys(announcement.linkedCharts).length > 0
                ) {
                    enrichment.linkedCharts = announcement.linkedCharts
                }
                if (
                    announcement.linkedDocuments &&
                    Object.keys(announcement.linkedDocuments).length > 0
                ) {
                    enrichment.linkedDocuments = announcement.linkedDocuments
                }
            }
            break
        }
    }

    return enrichment
}

function buildChronologicalRecord(
    gdoc: OwidGdoc,
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

    // Only enrich types that appear on the /latest page
    if (checkIsChronologicalFeedPost(gdoc)) {
        const enrichment = buildEnrichment(
            gdoc as ChronologicalGdoc,
            cloudflareImagesByFilename
        )
        Object.assign(base, enrichment)
    }

    return base
}

export async function indexIndividualGdocInChronological(
    gdoc: ChronologicalGdoc,
    knex: db.KnexReadonlyTransaction
): Promise<void> {
    if (!ALGOLIA_INDEXING) return
    if (!checkIsChronologicalFeedPost(gdoc)) return

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

    const records: PageChronologicalRecord[] = []
    for (const gdoc of gdocs) {
        if (!gdoc.content.type || !gdoc.publishedAt) continue

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
