import * as R from "remeda"
import {
    ANNOUNCEMENT_LATEST_TYPES,
    EMAIL_NOTIFICATIONS_CONTENT_TYPE_BY_LATEST_TYPE,
    LatestFeedGdoc,
    LatestType,
    OwidGdocType,
} from "@ourworldindata/types"
import {
    checkIsLatestFeedGdoc,
    getUniqueNamesFromTagHierarchies,
    spansToUnformattedPlainText,
} from "@ourworldindata/utils"
import { getCanonicalUrl } from "@ourworldindata/components"
import { deriveLatestType } from "../../site/latest/latestUtils.js"
import * as db from "../../db/db.js"
import { gdocFromJSON } from "../../db/model/Gdoc/GdocFactory.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import { GdocDataInsight } from "../../db/model/Gdoc/GdocDataInsight.js"
import { GdocAnnouncement } from "../../db/model/Gdoc/GdocAnnouncement.js"
import { extractFilenamesFromBlocks } from "../../db/model/Gdoc/gdocUtils.js"
import { getExcerptFromGdoc, getThumbnailUrl } from "../algolia/utils/pages.js"
import {
    BAKED_BASE_URL,
    CLOUDFLARE_IMAGES_URL,
} from "../../settings/serverSettings.js"
import { NotificationEmailItem } from "./emailNotificationsUtils.js"
import { resolveBodyLinks, resolveExcerptLinks } from "./excerptLinks.js"

// Turns recently published gdocs into the items the notification email
// renders. Kept out of sendEmailNotifications.ts so the dev-only email
// preview route can reuse it without pulling in that script's CLI entrypoint.

type LatestFeedGdocInstance = (GdocPost | GdocDataInsight | GdocAnnouncement) &
    LatestFeedGdoc

/**
 * DIs and announcements render their whole body.
 * Articles are summarized by their excerpt or `latest-feed-excerpt`.
 */
function checkShouldRenderBody(latestType: LatestType): boolean {
    return (
        latestType === "data-insight" ||
        ANNOUNCEMENT_LATEST_TYPES.includes(latestType as any)
    )
}

function getFirstTextBlockPlainText(gdoc: LatestFeedGdocInstance): string {
    const body = "body" in gdoc.content ? gdoc.content.body : undefined
    const firstTextBlock = body?.find((block) => block.type === "text")
    return firstTextBlock
        ? spansToUnformattedPlainText(firstTextBlock.value)
        : ""
}

function buildNotificationItem(
    gdoc: LatestFeedGdocInstance,
    topicHierarchiesByChildName: Awaited<
        ReturnType<typeof db.getTopicHierarchiesByChildName>
    >,
    cloudflareImagesByFilename: Awaited<
        ReturnType<typeof db.getCloudflareImagesByFilename>
    >
): NotificationEmailItem {
    const originalTagNames = gdoc.tags?.map((tag) => tag.name) ?? []
    const originalTagNamesPlusParents = R.unique([
        ...originalTagNames,
        ...getUniqueNamesFromTagHierarchies(
            originalTagNames,
            topicHierarchiesByChildName
        ),
    ])
    // Announcement gdocs split into latest types via their kicker.
    const latestType = deriveLatestType(gdoc)
    const item: NotificationEmailItem = {
        type: EMAIL_NOTIFICATIONS_CONTENT_TYPE_BY_LATEST_TYPE[latestType],
        latestType,
        slug: gdoc.slug,
        title: gdoc.content.title ?? "",
        url: getCanonicalUrl(BAKED_BASE_URL, gdoc),
        publishedAt: gdoc.publishedAt!,
        topicNames: originalTagNamesPlusParents,
        topicLabel: originalTagNames[0],
        authors: gdoc.content.authors ?? [],
    }

    if (checkShouldRenderBody(latestType)) {
        const body = gdoc.content.body || []
        item.body = resolveBodyLinks(body, gdoc.linkedDocuments, BAKED_BASE_URL)
        item.imageUrlsByFilename = {}
        for (const filename of extractFilenamesFromBlocks(body)) {
            const cloudflareId =
                cloudflareImagesByFilename[filename]?.cloudflareId
            if (cloudflareId) {
                item.imageUrlsByFilename[filename] =
                    `${CLOUDFLARE_IMAGES_URL}/${cloudflareId}/w=1200`
            }
        }
    }

    if (gdoc.content.type !== OwidGdocType.DataInsight) {
        item.excerpt =
            getExcerptFromGdoc(gdoc) || getFirstTextBlockPlainText(gdoc)
        if (gdoc.content.type === OwidGdocType.Article) {
            const latestFeedExcerpt = gdoc.content["latest-feed-excerpt"]
            if (latestFeedExcerpt?.length) {
                item.excerptBlocks = resolveExcerptLinks(
                    latestFeedExcerpt,
                    gdoc.linkedDocuments,
                    BAKED_BASE_URL
                )
            }
            item.thumbnailUrl = getThumbnailUrl(
                gdoc,
                cloudflareImagesByFilename
            )
        }
    }

    return item
}

export async function buildNotificationItems(
    knex: db.KnexReadonlyTransaction,
    since: Date
): Promise<NotificationEmailItem[]> {
    const gdocs = await db
        .getPublishedGdocsWithTags(
            knex,
            [
                OwidGdocType.Article,
                OwidGdocType.DataInsight,
                OwidGdocType.Announcement,
            ],
            { excludeDeprecated: true }
        )
        .then((rows) => rows.map(gdocFromJSON))

    const recentGdocs = gdocs.filter(
        (gdoc): gdoc is LatestFeedGdocInstance =>
            checkIsLatestFeedGdoc(gdoc) &&
            !!gdoc.publishedAt &&
            gdoc.publishedAt > since
    )
    if (recentGdocs.length === 0) return []

    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(knex)
    const cloudflareImagesByFilename =
        await db.getCloudflareImagesByFilename(knex)

    // Consumed by resolveBodyLinks / resolveExcerptLinks
    await Promise.all(
        recentGdocs
            .filter(
                (gdoc) =>
                    gdoc.content.type !== OwidGdocType.Article ||
                    gdoc.content["latest-feed-excerpt"]?.length
            )
            .map((gdoc) => gdoc.loadLinkedDocuments(knex))
    )

    return recentGdocs
        .map((gdoc) =>
            buildNotificationItem(
                gdoc,
                topicHierarchiesByChildName,
                cloudflareImagesByFilename
            )
        )
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}
