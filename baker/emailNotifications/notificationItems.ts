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
import {
    resolveBodyLinks,
    resolveExcerptLinks,
    resolveLinkUrl,
} from "./excerptLinks.js"

// Turns recently published gdocs into the items the notification email
// renders. Kept out of sendEmailNotifications.ts so the dev-only email
// preview route can reuse it without pulling in that script's CLI entrypoint.

type LatestFeedGdocInstance = (GdocPost | GdocDataInsight | GdocAnnouncement) &
    LatestFeedGdoc

/**
 * The latest types whose email rendering reads the gdoc body: data insights
 * and every kind of announcement. Articles are summarized by their excerpt
 * instead — an article body is far too long to travel in an email.
 */
const LATEST_TYPES_CARRYING_BODY = new Set<LatestType>([
    "data-insight",
    ...ANNOUNCEMENT_LATEST_TYPES,
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
    // Announcement gdocs split into latest types via their kicker.
    const latestType = deriveLatestType(gdoc)
    const item: NotificationEmailItem = {
        type: EMAIL_NOTIFICATIONS_CONTENT_TYPE_BY_LATEST_TYPE[latestType],
        latestType,
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
    if (LATEST_TYPES_CARRYING_BODY.has(latestType)) {
        const body = "body" in gdoc.content ? gdoc.content.body : undefined
        // Body links are stored as authored, so Google Doc links are resolved
        // against the gdoc's linked documents, loaded by the caller.
        item.body = resolveBodyLinks(
            body ?? [],
            gdoc.linkedDocuments,
            BAKED_BASE_URL
        )
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
        if (gdoc.content.type === OwidGdocType.Announcement) {
            const cta = gdoc.content.cta
            const url =
                cta?.url && cta.text
                    ? resolveLinkUrl(
                          cta.url,
                          gdoc.linkedDocuments,
                          BAKED_BASE_URL
                      )
                    : undefined
            if (url) item.cta = { text: cta!.text, url }
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

    // Everything the email reproduces — the bodies of data insights and
    // announcements, an article's authored /latest excerpt — can link to
    // other gdocs, and those links are stored as Google Doc URLs. Load the
    // linked documents so they can be resolved to public URLs. (Articles
    // without an excerpt are skipped: their body never reaches the email, and
    // they tend to link widely.)
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
