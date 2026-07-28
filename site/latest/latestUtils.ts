import {
    ANNOUNCEMENT_LATEST_TYPES,
    AnnouncementLatestType,
    LATEST_PAGE_TYPE_VALUES,
    LATEST_PATH,
    LATEST_TYPE_LABELS,
    LatestFeedGdoc,
    LatestNewsletter,
    LatestType,
    LatestUrlParam,
    PageChronologicalRecord,
} from "@ourworldindata/types"
import { OwidGdocType, slugify } from "@ourworldindata/utils"
import { match } from "ts-pattern"

/** Build the /latest page path, optionally pre-filtered by type. */
export function buildLatestPagePath(type?: LatestType): string {
    return type ? `${LATEST_PATH}?${LatestUrlParam.TYPE}=${type}` : LATEST_PATH
}

/** Decode the URL query `?type=` param back to a LatestType or null. */
export function decodeLatestType(param: string | null): LatestType | null {
    if (!param) return null
    return (LATEST_PAGE_TYPE_VALUES as readonly string[]).includes(param)
        ? (param as LatestType)
        : null
}

/**
 * Resolve an Announcement's LatestType from its kicker. Slugifies so
 * case/spacing variants ("Data Update", "Data update") still map to the
 * canonical slug. Anything else — missing, blank, or unrecognized — falls
 * back to "announcement". The save-side validator
 * (GdocAnnouncement._validateSubclass) only accepts the canonical slugs,
 * so any edit forces legacy values into shape.
 */
export function deriveAnnouncementLatestType(
    kicker?: string
): AnnouncementLatestType {
    const slug = slugify(kicker ?? "")
    return (ANNOUNCEMENT_LATEST_TYPES as readonly string[]).includes(slug)
        ? (slug as AnnouncementLatestType)
        : "announcement"
}

/**
 * Map a /latest-eligible gdoc to its LatestType. Articles and Data Insights
 * pass through from `content.type`; Announcements bucket via kicker. Used by
 * the indexer; render-site call sites that already know they have an
 * announcement should call `deriveAnnouncementLatestType` directly.
 */
export function deriveLatestType(gdoc: LatestFeedGdoc): LatestType {
    return match<LatestFeedGdoc, LatestType>(gdoc)
        .with({ content: { type: OwidGdocType.Article } }, () => "article")
        .with(
            { content: { type: OwidGdocType.DataInsight } },
            () => "data-insight"
        )
        .with({ content: { type: OwidGdocType.Announcement } }, (g) =>
            deriveAnnouncementLatestType(g.content.kicker)
        )
        .exhaustive()
}

/** Plural display label for a LatestType — used as the dropdown label on
 * /latest's "Filter by type" filter ("Articles", "Data Insights", …). */
export const latestTypeLabelPlural = (type: LatestType): string =>
    `${LATEST_TYPE_LABELS[type]}s`

/**
 * A single item in the /latest feed: either an Algolia-backed chronological
 * record or a newsletter injected into the page at bake time (newsletters
 * deliberately live outside the Algolia index — see LatestNewsletter).
 */
export type LatestFeedItem =
    | { kind: "record"; record: PageChronologicalRecord }
    | { kind: "newsletter"; newsletter: LatestNewsletter }

/**
 * Merge newsletters into the date-sorted record stream, preserving reverse
 * chronological order. Both inputs must be sorted by date descending.
 *
 * While more record pages remain to be fetched (`hasMoreRecords`), only
 * newsletters that fall within the already-loaded date range are woven in —
 * older ones join as later pages load, so items never appear out of order or
 * jump around.
 */
export function weaveNewslettersIntoFeed(
    records: PageChronologicalRecord[],
    newsletters: LatestNewsletter[],
    hasMoreRecords: boolean
): LatestFeedItem[] {
    const oldestLoadedDate = records[records.length - 1]?.date
    const eligible =
        hasMoreRecords && oldestLoadedDate
            ? newsletters.filter((n) => n.date >= oldestLoadedDate)
            : newsletters

    const items: LatestFeedItem[] = []
    let newsletterIndex = 0
    for (const record of records) {
        while (
            newsletterIndex < eligible.length &&
            eligible[newsletterIndex].date >= record.date
        ) {
            items.push({
                kind: "newsletter",
                newsletter: eligible[newsletterIndex++],
            })
        }
        items.push({ kind: "record", record })
    }
    while (newsletterIndex < eligible.length) {
        items.push({
            kind: "newsletter",
            newsletter: eligible[newsletterIndex++],
        })
    }
    return items
}

/** Grid positioning applied to the root of every hit card. */
export const LATEST_HIT_GRID_CLASSES =
    "span-cols-8 col-start-2 span-md-cols-12 col-md-start-2 span-sm-cols-14 col-sm-start-1"

/** Stable id for the announcement content heading, used by parent wrappers
 * (the feed's <article>) for aria-labelledby. */
export const announcementContentTitleId = (slug: string) =>
    `announcement-content-${slug}-title`

/**
 * Shape the hit record into the AttachmentsContext value expected by the
 * gdoc components that render inside each card (Image, ArticleBlocks, etc.).
 */
export function makeAttachments(hit: PageChronologicalRecord) {
    return {
        imageMetadata: "imageMetadata" in hit ? (hit.imageMetadata ?? {}) : {},
        linkedAuthors: "linkedAuthors" in hit ? (hit.linkedAuthors ?? []) : [],
        linkedCharts: "linkedCharts" in hit ? (hit.linkedCharts ?? {}) : {},
        linkedDocuments:
            "linkedDocuments" in hit ? (hit.linkedDocuments ?? {}) : {},
        // Intentionally empty: card-level rendering doesn't reach into these,
        // and indexing them per record would inflate the Algolia payload
        // unnecessarily. If a future card type needs them, add them to
        // PageChronologicalRecord and to the indexer in pagesChronological.ts.
        linkedIndicators: {},
        relatedCharts: [],
        tags: [],
    }
}
