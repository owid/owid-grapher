import * as _ from "lodash-es"
import * as db from "../../../db/db.js"
import {
    OwidGdocType,
    OwidGdocPostInterface,
    OwidGdocDataInsightInterface,
    getUniqueNamesFromTagHierarchies,
} from "@ourworldindata/utils"
import { PageChronologicalRecord } from "@ourworldindata/types"
import { gdocFromJSON } from "../../../db/model/Gdoc/GdocFactory.js"
import { getThumbnailUrl, getExcerptFromGdoc } from "./pages.js"

export async function getPagesChronologicalRecords(
    knex: db.KnexReadonlyTransaction
): Promise<PageChronologicalRecord[]> {
    const gdocs = (await db
        .getPublishedGdocsWithTags(
            knex,
            [
                OwidGdocType.Article,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
                OwidGdocType.AboutPage,
                OwidGdocType.DataInsight,
                OwidGdocType.Announcement,
            ],
            { excludeDeprecated: true }
        )
        .then((gdocs) => gdocs.map(gdocFromJSON))) as (
        | OwidGdocPostInterface
        | OwidGdocDataInsightInterface
    )[]

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
            modifiedDate: (
                gdoc.updatedAt ?? gdoc.publishedAt
            ).toISOString(),
            authors: gdoc.content.authors ?? [],
            tags: [...topicTags],
            thumbnailUrl: getThumbnailUrl(gdoc, cloudflareImagesByFilename),
        })
    }

    return records
}
