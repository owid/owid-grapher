import * as R from "remeda"
import {
    EMAIL_NOTIFICATIONS_CONTENT_TYPE_BY_LATEST_TYPE,
    EmailNotificationsContentType,
    LatestFeedGdoc,
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
import { resolveExcerptLinks } from "./excerptLinks.js"

// Turns recently published gdocs into the items the notification email
// renders. Kept out of sendEmailNotifications.ts so the dev-only email
// preview route can reuse it without pulling in that script's CLI entrypoint.

type LatestFeedGdocInstance = (GdocPost | GdocDataInsight | GdocAnnouncement) &
    LatestFeedGdoc

/**
 * The content types whose email rendering reads the gdoc body. The remaining
 * type, "article", is summarized by its excerpt instead — an article body is
 * far too long to travel in an email.
 */
const ITEM_TYPES_CARRYING_BODY = new Set<EmailNotificationsContentType>([
    "data-insight",
    "data-update",
    "announcement",
])

/**
 * Like `checkIsLatestFeedGdoc`, but narrows to the Gdoc *class* instances
 * returned by `gdocFromJSON`.
 */
function isLatestFeedGdocInstance(
    gdoc: ReturnType<typeof gdocFromJSON>
): gdoc is LatestFeedGdocInstance {
    return checkIsLatestFeedGdoc(gdoc)
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
    // Include the ancestor tags (e.g. the "Health" area for an item tagged
    // "Vaccination") so subscriptions to top-level areas match.
    const topicNames = R.unique([
        ...originalTagNames,
        ...getUniqueNamesFromTagHierarchies(
            originalTagNames,
            topicHierarchiesByChildName
        ),
    ])
    const item: NotificationEmailItem = {
        // Announcement gdocs split into "data-update" / "article" /
        // "announcement" content types via their kicker.
        type: EMAIL_NOTIFICATIONS_CONTENT_TYPE_BY_LATEST_TYPE[
            deriveLatestType(gdoc)
        ],
        slug: gdoc.slug,
        title: gdoc.content.title ?? "",
        url: getCanonicalUrl(BAKED_BASE_URL, gdoc),
        publishedAt: gdoc.publishedAt!,
        topicNames,
        topicLabel: originalTagNames[0],
        authors: gdoc.content.authors ?? [],
    }

    // Data insights ship their full content in the email; data updates and
    // announcements ship their lead paragraphs, as they do on /latest.
    if (ITEM_TYPES_CARRYING_BODY.has(item.type)) {
        const body = "body" in gdoc.content ? gdoc.content.body : undefined
        item.body = body
        item.imageUrlByFilename = {}
        for (const filename of extractFilenamesFromBlocks(body ?? [])) {
            const cloudflareId =
                cloudflareImagesByFilename[filename]?.cloudflareId
            if (cloudflareId) {
                item.imageUrlByFilename[filename] =
                    `${CLOUDFLARE_IMAGES_URL}/${cloudflareId}/w=1200`
            }
        }
    }

    if (gdoc.content.type !== OwidGdocType.DataInsight) {
        // Announcements with a top-level {.cta} have an empty body, so the
        // excerpt stays as their fallback.
        item.excerpt =
            getExcerptFromGdoc(gdoc) || getFirstTextBlockPlainText(gdoc)
        if (gdoc.content.type === OwidGdocType.Article) {
            // An article can carry an excerpt written for the /latest feed;
            // it's richer than the summary excerpt (several paragraphs, some
            // emphasis, links), so prefer it here too. Its links are resolved
            // against the gdoc's linked documents, loaded by the caller.
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
            isLatestFeedGdocInstance(gdoc) &&
            !!gdoc.publishedAt &&
            gdoc.publishedAt > since
    )
    if (recentGdocs.length === 0) return []

    const topicHierarchiesByChildName =
        await db.getTopicHierarchiesByChildName(knex)
    const cloudflareImagesByFilename =
        await db.getCloudflareImagesByFilename(knex)

    // Articles with an authored /latest excerpt can link to other gdocs, and
    // those links are stored as Google Doc URLs. Load the linked documents so
    // the excerpt's links can be resolved to public URLs.
    await Promise.all(
        recentGdocs
            .filter(
                (gdoc) =>
                    gdoc.content.type === OwidGdocType.Article &&
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
