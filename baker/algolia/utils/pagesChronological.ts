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
} from "@ourworldindata/types"
import { gdocFromJSON } from "../../../db/model/Gdoc/GdocFactory.js"
import { getAlgoliaClient } from "../configureAlgolia.js"
import { getIndexName } from "../../../site/search/searchClient.js"
import { ALGOLIA_INDEXING } from "../../../settings/serverSettings.js"
import { getThumbnailUrl, getExcerptFromGdoc } from "./pages.js"

async function buildRecord(
    gdoc:
        | OwidGdocPostInterface
        | OwidGdocDataInsightInterface
        | OwidGdocAnnouncementInterface,
    knex: db.KnexReadonlyTransaction
): Promise<PageChronologicalRecord> {
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

    return {
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
}

export async function indexIndividualGdocInChronological(
    gdoc:
        | OwidGdocPostInterface
        | OwidGdocDataInsightInterface
        | OwidGdocAnnouncementInterface,
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

    const indexName = getIndexName(SearchIndexName.PagesChronological)
    const record = await buildRecord(gdoc, knex)

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

        records.push({
            objectID: gdoc.id,
            type: gdoc.content.type,
            slug: gdoc.slug,
            title: gdoc.content.title || "",
            excerpt: getExcerptFromGdoc(gdoc),
            date: gdoc.publishedAt.toISOString(),
            modifiedDate: (gdoc.updatedAt ?? gdoc.publishedAt).toISOString(),
            authors: gdoc.content.authors ?? [],
            tags: [...topicTags],
            thumbnailUrl: getThumbnailUrl(gdoc, cloudflareImagesByFilename),
        })
    }

    return records
}
